import {
  db,
  type BackupSnapshotRecord,
  type ExerciseDefaultRecord,
  type ExerciseFavoriteRecord,
  type ExerciseMetric,
  type ExerciseGoalMode,
  type ExerciseRecentRecord,
  type ExerciseRecord,
  type PlannedWorkoutOccurrenceRecord,
  type PlannedWorkoutSeriesRecord,
  type RoutineRecord,
  type SettingsRecord,
  type WorkoutRecord,
  type WorkoutSetRecord,
  type AdvancedSetType
} from './db';
import { defaultSettings } from './settings';
import { normalizeName } from './exercises';

export const FULL_BACKUP_TYPE = 'gym-app-full';
export const FULL_BACKUP_SCHEMA_VERSION = 1;
export const FULL_BACKUP_MAX_FILE_BYTES = 20 * 1024 * 1024;
const AUTO_BACKUP_RETENTION = 3;

export type FullBackupImportMode = 'merge' | 'replace';

type TranslationLite = {
  language: string;
  name: string;
};

type CustomExerciseBundle = {
  exercise: ExerciseRecord;
  translations: TranslationLite[];
};

type RoutineExerciseDefaultsLite = {
  metricTypeOverride?: ExerciseMetric;
  defaultSetTypes?: AdvancedSetType[];
  defaultSets?: number;
  defaultReps?: number;
  defaultWeight?: number;
  defaultDuration?: number;
  defaultDistance?: number;
  defaultRestSeconds?: number;
  goalMode?: ExerciseGoalMode;
};

type RoutineBundle = {
  routine: RoutineRecord;
  tags: string[];
  exercises: Array<{
    exerciseId: string;
    order: number;
    defaults?: RoutineExerciseDefaultsLite;
  }>;
};

type WorkoutBundle = {
  workout: WorkoutRecord;
  exercises: Array<{
    exerciseId: string;
    name: string;
    order: number;
    notes?: string;
    sets: Array<{
      order: number;
      setType?: AdvancedSetType;
      weight?: number;
      reps?: number;
      duration?: number;
      distance?: number;
      rpe?: number;
      completed: boolean;
    }>;
  }>;
};

export interface FullBackupData {
  settings: SettingsRecord;
  customExercises: CustomExerciseBundle[];
  exerciseFavorites: ExerciseFavoriteRecord[];
  exerciseRecents: ExerciseRecentRecord[];
  routines: RoutineBundle[];
  workouts: WorkoutBundle[];
  plannedWorkoutSeries: PlannedWorkoutSeriesRecord[];
  plannedWorkoutOccurrences: PlannedWorkoutOccurrenceRecord[];
}

export interface FullBackupPayload {
  backupType: typeof FULL_BACKUP_TYPE;
  schemaVersion: number;
  exportedAt: string;
  data: FullBackupData;
}

export interface FullBackupPreview {
  schemaVersion: number;
  exportedAt: string;
  counts: {
    customExercises: number;
    favorites: number;
    recents: number;
    routines: number;
    workouts: number;
    plannedSeries: number;
    plannedOccurrences: number;
  };
}

type ImportSection =
  | 'settings'
  | 'customExercises'
  | 'favorites'
  | 'recents'
  | 'routines'
  | 'workouts'
  | 'plannedSeries'
  | 'plannedOccurrences';

interface ImportSectionCount {
  imported: number;
  merged: number;
  skipped: number;
  renamed: number;
}

export interface FullBackupImportResult {
  mode: FullBackupImportMode;
  autoBackup: {
    id: string;
    createdAt: string;
  };
  sections: Record<ImportSection, ImportSectionCount>;
  totals: ImportSectionCount;
}

export class FullBackupError extends Error {
  constructor(
    public readonly code:
      | 'invalid-json'
      | 'wrong-backup-type'
      | 'invalid-backup'
      | 'incomplete-backup'
      | 'unsupported-schema-version'
      | 'corrupt-backup'
      | 'file-too-large'
  ) {
    super(code);
    this.name = 'FullBackupError';
  }
}

function createEmptySectionCount(): ImportSectionCount {
  return {
    imported: 0,
    merged: 0,
    skipped: 0,
    renamed: 0
  };
}

function createEmptyImportSections(): Record<ImportSection, ImportSectionCount> {
  return {
    settings: createEmptySectionCount(),
    customExercises: createEmptySectionCount(),
    favorites: createEmptySectionCount(),
    recents: createEmptySectionCount(),
    routines: createEmptySectionCount(),
    workouts: createEmptySectionCount(),
    plannedSeries: createEmptySectionCount(),
    plannedOccurrences: createEmptySectionCount()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ensureArray<T>(value: unknown, code: FullBackupError['code']): T[] {
  if (!Array.isArray(value)) {
    throw new FullBackupError(code);
  }
  return value as T[];
}

function ensureString(value: unknown, code: FullBackupError['code']) {
  if (typeof value !== 'string') {
    throw new FullBackupError(code);
  }
  return value;
}

function latestTimestamp(updatedAt?: string, deletedAt?: string | null) {
  return deletedAt && deletedAt > (updatedAt ?? '') ? deletedAt : updatedAt ?? '';
}

function incomingWins(
  incomingUpdatedAt?: string,
  incomingDeletedAt?: string | null,
  currentUpdatedAt?: string,
  currentDeletedAt?: string | null
) {
  return latestTimestamp(incomingUpdatedAt, incomingDeletedAt) >
    latestTimestamp(currentUpdatedAt, currentDeletedAt);
}

function normalizeSettingsTimestamp(settings: SettingsRecord) {
  return (
    settings.settingsUpdatedAt ??
    settings.notificationSettingsUpdatedAt ??
    defaultSettings.settingsUpdatedAt ??
    '1970-01-01T00:00:00.000Z'
  );
}

function ensureUniqueName(
  baseName: string,
  takenNormalizedNames: Set<string>,
  normalize: (value: string) => string
) {
  let nextName = baseName.trim();
  if (!nextName) {
    nextName = 'Sin nombre';
  }
  let candidate = nextName;
  let suffix = 2;
  while (takenNormalizedNames.has(normalize(candidate))) {
    candidate = `${nextName} (${suffix})`;
    suffix += 1;
  }
  takenNormalizedNames.add(normalize(candidate));
  return candidate;
}

function getTotals(sections: Record<ImportSection, ImportSectionCount>): ImportSectionCount {
  return (Object.keys(sections) as ImportSection[]).reduce(
    (acc, key) => ({
      imported: acc.imported + sections[key].imported,
      merged: acc.merged + sections[key].merged,
      skipped: acc.skipped + sections[key].skipped,
      renamed: acc.renamed + sections[key].renamed
    }),
    createEmptySectionCount()
  );
}

export async function exportFullBackup(): Promise<FullBackupPayload> {
  const [
    settings,
    customExercises,
    exerciseFavorites,
    exerciseRecents,
    routines,
    routineTags,
    routineExercises,
    exerciseDefaults,
    workouts,
    workoutExercises,
    workoutSets,
    plannedWorkoutSeries,
    plannedWorkoutOccurrences
  ] = await Promise.all([
    db.settings.get('app'),
    db.exercises.filter((exercise) => exercise.isCustom).toArray(),
    db.exerciseFavorites.toArray(),
    db.exerciseRecents.toArray(),
    db.routines.toArray(),
    db.routineTags.toArray(),
    db.routineExercises.toArray(),
    db.exerciseDefaults.toArray(),
    db.workouts.toArray(),
    db.workoutExercises.toArray(),
    db.workoutSets.toArray(),
    db.plannedWorkoutSeries.toArray(),
    db.plannedWorkoutOccurrences.toArray()
  ]);

  const customExerciseIds = customExercises.map((exercise) => exercise.id);
  const translations = customExerciseIds.length
    ? await db.exerciseTranslations.where('exerciseId').anyOf(customExerciseIds).toArray()
    : [];

  const translationMap = translations.reduce<Record<string, TranslationLite[]>>((acc, translation) => {
    if (!acc[translation.exerciseId]) {
      acc[translation.exerciseId] = [];
    }
    acc[translation.exerciseId].push({
      language: translation.language,
      name: translation.name
    });
    return acc;
  }, {});

  const routinesById = new Map<string, RoutineBundle>(
    routines.map((routine) => [
      routine.id,
      {
        routine,
        tags: [],
        exercises: []
      }
    ])
  );

  routineTags.forEach((tag) => {
    const bundle = routinesById.get(tag.routineId);
    if (!bundle) return;
    bundle.tags.push(tag.tag);
  });

  routineExercises.forEach((entry) => {
    const bundle = routinesById.get(entry.routineId);
    if (!bundle) return;
    const defaults = exerciseDefaults.find(
      (item) => item.routineId === entry.routineId && item.exerciseId === entry.exerciseId
    );
    bundle.exercises.push({
      exerciseId: entry.exerciseId,
      order: entry.order,
      defaults: defaults
        ? {
            metricTypeOverride: defaults.metricTypeOverride,
            defaultSetTypes: defaults.defaultSetTypes,
            defaultSets: defaults.defaultSets,
            defaultReps: defaults.defaultReps,
            defaultWeight: defaults.defaultWeight,
            defaultDuration: defaults.defaultDuration,
            defaultDistance: defaults.defaultDistance,
            defaultRestSeconds: defaults.defaultRestSeconds,
            goalMode: defaults.goalMode
          }
        : undefined
    });
  });

  const workoutsById = new Map<string, WorkoutBundle>(
    workouts.map((workout) => [
      workout.id,
      {
        workout,
        exercises: []
      }
    ])
  );

  const workoutExerciseMap = new Map<string, WorkoutBundle['exercises'][number]>();

  workoutExercises.forEach((workoutExercise) => {
    const bundle = workoutsById.get(workoutExercise.workoutId);
    if (!bundle) return;
    const exerciseBundle = {
      exerciseId: workoutExercise.exerciseId,
      name: workoutExercise.name,
      order: workoutExercise.order,
      notes: workoutExercise.notes,
      sets: [] as WorkoutBundle['exercises'][number]['sets']
    };
    bundle.exercises.push(exerciseBundle);
    workoutExerciseMap.set(workoutExercise.id, exerciseBundle);
  });

  workoutSets.forEach((set) => {
    const exerciseBundle = workoutExerciseMap.get(set.workoutExerciseId);
    if (!exerciseBundle) return;
    exerciseBundle.sets.push({
      order: set.order,
      setType: set.setType,
      weight: set.weight,
      reps: set.reps,
      duration: set.duration,
      distance: set.distance,
      rpe: set.rpe,
      completed: set.completed
    });
  });

  const serializedSettings: SettingsRecord = {
    ...defaultSettings,
    ...(settings ?? {}),
    id: 'app',
    settingsUpdatedAt:
      settings?.settingsUpdatedAt ??
      settings?.notificationSettingsUpdatedAt ??
      defaultSettings.settingsUpdatedAt
  };

  return {
    backupType: FULL_BACKUP_TYPE,
    schemaVersion: FULL_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: serializedSettings,
      customExercises: customExercises
        .map((exercise) => ({
          exercise: {
            ...exercise,
            source: 'custom' as const
          },
          translations: translationMap[exercise.id] ?? []
        }))
        .sort((a, b) => a.exercise.id.localeCompare(b.exercise.id)),
      exerciseFavorites: [...exerciseFavorites].sort((a, b) => a.exerciseId.localeCompare(b.exerciseId)),
      exerciseRecents: [...exerciseRecents].sort((a, b) => a.exerciseId.localeCompare(b.exerciseId)),
      routines: Array.from(routinesById.values())
        .map((bundle) => ({
          routine: bundle.routine,
          tags: [...new Set(bundle.tags)].sort((a, b) => a.localeCompare(b)),
          exercises: [...bundle.exercises].sort((a, b) => a.order - b.order)
        }))
        .sort((a, b) => a.routine.order - b.routine.order || a.routine.id.localeCompare(b.routine.id)),
      workouts: Array.from(workoutsById.values())
        .map((bundle) => ({
          workout: bundle.workout,
          exercises: bundle.exercises
            .map((exercise) => ({
              ...exercise,
              sets: [...exercise.sets].sort((a, b) => a.order - b.order)
            }))
            .sort((a, b) => a.order - b.order)
        }))
        .sort((a, b) => a.workout.startedAt.localeCompare(b.workout.startedAt)),
      plannedWorkoutSeries: [...plannedWorkoutSeries].sort((a, b) => a.id.localeCompare(b.id)),
      plannedWorkoutOccurrences: [...plannedWorkoutOccurrences].sort((a, b) => a.id.localeCompare(b.id))
    }
  };
}

function normalizeFullBackupData(data: Record<string, unknown>): FullBackupData {
  const settings = {
    ...defaultSettings,
    ...(isRecord(data.settings) ? (data.settings as Partial<SettingsRecord>) : {})
  };

  if (settings.id !== 'app') {
    throw new FullBackupError('incomplete-backup');
  }

  if (settings.theme !== 'dark' && settings.theme !== 'light') {
    throw new FullBackupError('incomplete-backup');
  }

  if (settings.language !== 'es' || settings.units !== 'kg') {
    throw new FullBackupError('incomplete-backup');
  }

  const customExercises = ensureArray<CustomExerciseBundle>(
    data.customExercises,
    'incomplete-backup'
  ).map((item) => {
    if (!isRecord(item) || !isRecord(item.exercise)) {
      throw new FullBackupError('incomplete-backup');
    }
    const exercise = item.exercise as ExerciseRecord;
    if (!exercise.id || !exercise.baseName || !exercise.isCustom) {
      throw new FullBackupError('incomplete-backup');
    }
    const translations = ensureArray<TranslationLite>(item.translations ?? [], 'incomplete-backup').map(
      (translation) => {
        if (!isRecord(translation)) {
          throw new FullBackupError('incomplete-backup');
        }
        return {
          language: ensureString(translation.language, 'incomplete-backup'),
          name: ensureString(translation.name, 'incomplete-backup')
        };
      }
    );
    return {
      exercise: {
        ...exercise,
        source: 'custom' as const,
        normalizedName: normalizeName(exercise.baseName),
        isCustom: true
      },
      translations
    };
  });

  const exerciseFavorites = ensureArray<ExerciseFavoriteRecord>(
    data.exerciseFavorites,
    'incomplete-backup'
  ).map((favorite) => {
    if (!isRecord(favorite) || typeof favorite.exerciseId !== 'string') {
      throw new FullBackupError('incomplete-backup');
    }
    return favorite as ExerciseFavoriteRecord;
  });

  const exerciseRecents = ensureArray<ExerciseRecentRecord>(
    data.exerciseRecents,
    'incomplete-backup'
  ).map((recent) => {
    if (!isRecord(recent) || typeof recent.exerciseId !== 'string') {
      throw new FullBackupError('incomplete-backup');
    }
    return recent as ExerciseRecentRecord;
  });

  const routines = ensureArray<RoutineBundle>(data.routines, 'incomplete-backup').map((bundle) => {
    if (!isRecord(bundle) || !isRecord(bundle.routine)) {
      throw new FullBackupError('incomplete-backup');
    }
    const routine = bundle.routine as RoutineRecord;
    if (!routine.id || !routine.name || !routine.createdAt || !routine.updatedAt) {
      throw new FullBackupError('incomplete-backup');
    }
    const tags = ensureArray<string>(bundle.tags ?? [], 'incomplete-backup')
      .filter((tag) => typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const exercises = ensureArray<RoutineBundle['exercises'][number]>(
      bundle.exercises ?? [],
      'incomplete-backup'
    ).map((entry) => {
      if (!isRecord(entry) || typeof entry.exerciseId !== 'string' || typeof entry.order !== 'number') {
        throw new FullBackupError('incomplete-backup');
      }
      return {
        exerciseId: entry.exerciseId,
        order: entry.order,
        defaults: isRecord(entry.defaults)
          ? (entry.defaults as RoutineExerciseDefaultsLite)
          : undefined
      };
    });
    return {
      routine,
      tags: [...new Set(tags)],
      exercises
    };
  });

  const workouts = ensureArray<WorkoutBundle>(data.workouts, 'incomplete-backup').map((bundle) => {
    if (!isRecord(bundle) || !isRecord(bundle.workout)) {
      throw new FullBackupError('incomplete-backup');
    }
    const workout = bundle.workout as WorkoutRecord;
    if (!workout.id || !workout.startedAt || !workout.endedAt || !workout.updatedAt) {
      throw new FullBackupError('incomplete-backup');
    }
    const exercises = ensureArray<WorkoutBundle['exercises'][number]>(
      bundle.exercises ?? [],
      'incomplete-backup'
    ).map((exercise) => {
      if (
        !isRecord(exercise) ||
        typeof exercise.exerciseId !== 'string' ||
        typeof exercise.name !== 'string' ||
        typeof exercise.order !== 'number'
      ) {
        throw new FullBackupError('incomplete-backup');
      }
      const sets = ensureArray<WorkoutBundle['exercises'][number]['sets']>(
        exercise.sets ?? [],
        'incomplete-backup'
      ).map((set) => {
        if (!isRecord(set) || typeof set.order !== 'number' || typeof set.completed !== 'boolean') {
          throw new FullBackupError('incomplete-backup');
        }
        return {
          order: set.order,
          setType: set.setType as AdvancedSetType | undefined,
          weight: typeof set.weight === 'number' ? set.weight : undefined,
          reps: typeof set.reps === 'number' ? set.reps : undefined,
          duration: typeof set.duration === 'number' ? set.duration : undefined,
          distance: typeof set.distance === 'number' ? set.distance : undefined,
          rpe: typeof set.rpe === 'number' ? set.rpe : undefined,
          completed: set.completed
        };
      });
      return {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        order: exercise.order,
        notes: typeof exercise.notes === 'string' ? exercise.notes : undefined,
        sets
      };
    });
    return {
      workout,
      exercises
    };
  });

  const plannedWorkoutSeries = ensureArray<PlannedWorkoutSeriesRecord>(
    data.plannedWorkoutSeries,
    'incomplete-backup'
  ).map((series) => {
    if (!isRecord(series) || typeof series.id !== 'string' || typeof series.routineId !== 'string') {
      throw new FullBackupError('incomplete-backup');
    }
    return series as PlannedWorkoutSeriesRecord;
  });

  const plannedWorkoutOccurrences = ensureArray<PlannedWorkoutOccurrenceRecord>(
    data.plannedWorkoutOccurrences,
    'incomplete-backup'
  ).map((occurrence) => {
    if (!isRecord(occurrence) || typeof occurrence.id !== 'string' || typeof occurrence.seriesId !== 'string') {
      throw new FullBackupError('incomplete-backup');
    }
    return occurrence as PlannedWorkoutOccurrenceRecord;
  });

  return {
    settings: {
      ...settings,
      settingsUpdatedAt:
        settings.settingsUpdatedAt ??
        settings.notificationSettingsUpdatedAt ??
        defaultSettings.settingsUpdatedAt
    },
    customExercises,
    exerciseFavorites,
    exerciseRecents,
    routines,
    workouts,
    plannedWorkoutSeries,
    plannedWorkoutOccurrences
  };
}

async function validateReferences(data: FullBackupData) {
  const customExerciseIds = new Set(data.customExercises.map((entry) => entry.exercise.id));
  const knownExerciseIds = new Set((await db.exercises.toArray()).map((entry) => entry.id));
  customExerciseIds.forEach((id) => knownExerciseIds.add(id));
  const routineIds = new Set(data.routines.map((entry) => entry.routine.id));
  const seriesIds = new Set(data.plannedWorkoutSeries.map((entry) => entry.id));

  for (const bundle of data.customExercises) {
    for (const translation of bundle.translations) {
      if (!translation.language.trim() || !translation.name.trim()) {
        throw new FullBackupError('corrupt-backup');
      }
    }
  }

  for (const favorite of data.exerciseFavorites) {
    if (!knownExerciseIds.has(favorite.exerciseId)) {
      throw new FullBackupError('corrupt-backup');
    }
  }

  for (const recent of data.exerciseRecents) {
    if (!knownExerciseIds.has(recent.exerciseId)) {
      throw new FullBackupError('corrupt-backup');
    }
  }

  for (const bundle of data.routines) {
    for (const entry of bundle.exercises) {
      if (!knownExerciseIds.has(entry.exerciseId)) {
        throw new FullBackupError('corrupt-backup');
      }
    }
  }

  for (const bundle of data.workouts) {
    for (const exercise of bundle.exercises) {
      if (!knownExerciseIds.has(exercise.exerciseId)) {
        throw new FullBackupError('corrupt-backup');
      }
    }
  }

  for (const series of data.plannedWorkoutSeries) {
    if (!routineIds.has(series.routineId) && !series.deletedAt) {
      throw new FullBackupError('corrupt-backup');
    }
  }

  for (const occurrence of data.plannedWorkoutOccurrences) {
    if (!seriesIds.has(occurrence.seriesId)) {
      throw new FullBackupError('corrupt-backup');
    }
  }
}

function parseRawPayload(raw: unknown): FullBackupPayload {
  if (!isRecord(raw)) {
    throw new FullBackupError('invalid-backup');
  }

  if ('version' in raw && !('backupType' in raw)) {
    throw new FullBackupError('wrong-backup-type');
  }

  if (raw.backupType !== FULL_BACKUP_TYPE) {
    throw new FullBackupError('invalid-backup');
  }

  if (typeof raw.schemaVersion !== 'number') {
    throw new FullBackupError('incomplete-backup');
  }

  if (raw.schemaVersion > FULL_BACKUP_SCHEMA_VERSION) {
    throw new FullBackupError('unsupported-schema-version');
  }

  if (raw.schemaVersion < 1) {
    throw new FullBackupError('unsupported-schema-version');
  }

  if (!isRecord(raw.data)) {
    throw new FullBackupError('incomplete-backup');
  }

  const data = normalizeFullBackupData(raw.data);

  return {
    backupType: FULL_BACKUP_TYPE,
    schemaVersion: FULL_BACKUP_SCHEMA_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    data
  };
}

export async function parseAndValidateFullBackupText(text: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new FullBackupError('invalid-json');
  }
  const payload = parseRawPayload(raw);
  await validateReferences(payload.data);
  return payload;
}

export async function parseAndValidateFullBackupFile(file: File) {
  if (file.size > FULL_BACKUP_MAX_FILE_BYTES) {
    throw new FullBackupError('file-too-large');
  }
  const text = await file.text();
  return parseAndValidateFullBackupText(text);
}

export function previewFullBackup(payload: FullBackupPayload): FullBackupPreview {
  return {
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    counts: {
      customExercises: payload.data.customExercises.filter((entry) => !entry.exercise.deletedAt).length,
      favorites: payload.data.exerciseFavorites.filter((entry) => !entry.deletedAt).length,
      recents: payload.data.exerciseRecents.length,
      routines: payload.data.routines.filter((entry) => !entry.routine.deletedAt).length,
      workouts: payload.data.workouts.filter((entry) => !entry.workout.deletedAt).length,
      plannedSeries: payload.data.plannedWorkoutSeries.filter((entry) => !entry.deletedAt).length,
      plannedOccurrences: payload.data.plannedWorkoutOccurrences.filter((entry) => !entry.deletedAt).length
    }
  };
}

async function createPreImportAutoBackup() {
  const payload = await exportFullBackup();
  const createdAt = new Date().toISOString();
  const snapshot: BackupSnapshotRecord = {
    id: `backup-${crypto.randomUUID()}`,
    kind: 'pre-import',
    createdAt,
    schemaVersion: payload.schemaVersion,
    payload: JSON.stringify(payload)
  };
  await db.backupSnapshots.add(snapshot);

  const snapshots = await db.backupSnapshots.orderBy('createdAt').reverse().toArray();
  const stale = snapshots.slice(AUTO_BACKUP_RETENTION);
  if (stale.length) {
    await db.backupSnapshots.bulkDelete(stale.map((entry) => entry.id));
  }
  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt
  };
}

function toRoutineDefaultRecord(
  routineId: string,
  exerciseId: string,
  defaults: RoutineExerciseDefaultsLite
): ExerciseDefaultRecord {
  return {
    id: `default-${crypto.randomUUID()}`,
    routineId,
    exerciseId,
    metricTypeOverride: defaults.metricTypeOverride,
    defaultSetTypes: defaults.defaultSetTypes,
    defaultSets: defaults.defaultSets,
    defaultReps: defaults.defaultReps,
    defaultWeight: defaults.defaultWeight,
    defaultDuration: defaults.defaultDuration,
    defaultDistance: defaults.defaultDistance,
    defaultRestSeconds: defaults.defaultRestSeconds,
    goalMode: defaults.goalMode
  };
}

async function applyReplace(
  payload: FullBackupPayload,
  sections: Record<ImportSection, ImportSectionCount>
) {
  const now = new Date().toISOString();

  const baseExercises = await db.exercises
    .filter((exercise) => !exercise.isCustom)
    .toArray();
  const takenExerciseNames = new Set(baseExercises.map((exercise) => normalizeName(exercise.baseName)));
  const takenRoutineNames = new Set<string>();

  const existingCustomExercises = await db.exercises.filter((exercise) => exercise.isCustom).toArray();
  const customExerciseIds = existingCustomExercises.map((exercise) => exercise.id);
  if (customExerciseIds.length) {
    await db.exercises.bulkDelete(customExerciseIds);
    const customTranslations = await db.exerciseTranslations
      .where('exerciseId')
      .anyOf(customExerciseIds)
      .toArray();
    if (customTranslations.length) {
      await db.exerciseTranslations.bulkDelete(customTranslations.map((entry) => entry.id));
    }
  }

  await Promise.all([
    db.exerciseFavorites.clear(),
    db.exerciseRecents.clear(),
    db.routineTags.clear(),
    db.routineExercises.clear(),
    db.exerciseDefaults.clear(),
    db.routineVersions.clear(),
    db.routines.clear(),
    db.workoutSets.clear(),
    db.workoutExercises.clear(),
    db.workouts.clear(),
    db.plannedWorkoutOccurrences.clear(),
    db.plannedWorkoutSeries.clear(),
    db.wrkoutTips.clear()
  ]);

  await db.settings.put({
    ...payload.data.settings,
    id: 'app',
    settingsUpdatedAt: payload.data.settings.settingsUpdatedAt ?? now
  });
  sections.settings.imported += 1;

  for (const bundle of payload.data.customExercises) {
    const exercise = {
      ...bundle.exercise,
      id: bundle.exercise.id,
      source: 'custom' as const,
      isCustom: true,
      normalizedName: normalizeName(bundle.exercise.baseName),
      createdAt: bundle.exercise.createdAt ?? now,
      updatedAt: bundle.exercise.updatedAt ?? bundle.exercise.createdAt ?? now
    };
    if (!exercise.deletedAt) {
      const uniqueName = ensureUniqueName(exercise.baseName, takenExerciseNames, normalizeName);
      if (uniqueName !== exercise.baseName) {
        sections.customExercises.renamed += 1;
      }
      exercise.baseName = uniqueName;
      exercise.normalizedName = normalizeName(uniqueName);
    }
    await db.exercises.put(exercise);
    const translations = bundle.translations.length
      ? bundle.translations.map((translation) => ({
          id: `${exercise.id}-${translation.language}`,
          exerciseId: exercise.id,
          language: translation.language,
          name: translation.name
        }))
      : [
          {
            id: `${exercise.id}-es`,
            exerciseId: exercise.id,
            language: 'es',
            name: exercise.baseName
          }
        ];
    await db.exerciseTranslations.bulkPut(translations);
    sections.customExercises.imported += 1;
  }

  if (payload.data.exerciseFavorites.length) {
    await db.exerciseFavorites.bulkPut(payload.data.exerciseFavorites);
    sections.favorites.imported += payload.data.exerciseFavorites.length;
  }
  if (payload.data.exerciseRecents.length) {
    await db.exerciseRecents.bulkPut(payload.data.exerciseRecents);
    sections.recents.imported += payload.data.exerciseRecents.length;
  }

  for (const bundle of payload.data.routines) {
    const routine = {
      ...bundle.routine,
      createdAt: bundle.routine.createdAt ?? now,
      updatedAt: bundle.routine.updatedAt ?? bundle.routine.createdAt ?? now
    };
    if (!routine.deletedAt) {
      const uniqueName = ensureUniqueName(
        routine.name,
        takenRoutineNames,
        (value) => value.trim().toLowerCase()
      );
      if (uniqueName !== routine.name) {
        sections.routines.renamed += 1;
      }
      routine.name = uniqueName;
    }
    await db.routines.put(routine);

    if (!routine.deletedAt) {
      const tags = [...new Set(bundle.tags)]
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => ({
          id: `${routine.id}-${tag}`,
          routineId: routine.id,
          tag
        }));
      if (tags.length) {
        await db.routineTags.bulkPut(tags);
      }

      const exercises = [...bundle.exercises].sort((a, b) => a.order - b.order);
      if (exercises.length) {
        await db.routineExercises.bulkPut(
          exercises.map((entry) => ({
            id: `routine-exercise-${crypto.randomUUID()}`,
            routineId: routine.id,
            exerciseId: entry.exerciseId,
            order: entry.order
          }))
        );
        const defaults = exercises
          .filter((entry) => entry.defaults)
          .map((entry) => toRoutineDefaultRecord(routine.id, entry.exerciseId, entry.defaults!));
        if (defaults.length) {
          await db.exerciseDefaults.bulkPut(defaults);
        }
      }
    }
    sections.routines.imported += 1;
  }

  for (const bundle of payload.data.workouts) {
    const workout = {
      ...bundle.workout,
      startedAt: bundle.workout.startedAt ?? now,
      endedAt: bundle.workout.endedAt ?? bundle.workout.startedAt ?? now,
      updatedAt: bundle.workout.updatedAt ?? bundle.workout.endedAt ?? now
    };
    await db.workouts.put(workout);
    if (!workout.deletedAt) {
      for (const exercise of bundle.exercises) {
        const workoutExerciseId = `workout-exercise-${crypto.randomUUID()}`;
        await db.workoutExercises.put({
          id: workoutExerciseId,
          workoutId: workout.id,
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          order: exercise.order,
          notes: exercise.notes
        });
        if (exercise.sets.length) {
          await db.workoutSets.bulkPut(
            exercise.sets.map((set) => ({
              id: `workout-set-${crypto.randomUUID()}`,
              workoutExerciseId,
              order: set.order,
              setType: set.setType,
              weight: set.weight,
              reps: set.reps,
              duration: set.duration,
              distance: set.distance,
              rpe: set.rpe,
              completed: set.completed
            }))
          );
        }
      }
    }
    sections.workouts.imported += 1;
  }

  if (payload.data.plannedWorkoutSeries.length) {
    await db.plannedWorkoutSeries.bulkPut(payload.data.plannedWorkoutSeries);
    sections.plannedSeries.imported += payload.data.plannedWorkoutSeries.length;
  }
  if (payload.data.plannedWorkoutOccurrences.length) {
    await db.plannedWorkoutOccurrences.bulkPut(payload.data.plannedWorkoutOccurrences);
    sections.plannedOccurrences.imported += payload.data.plannedWorkoutOccurrences.length;
  }
}

async function applyMerge(
  payload: FullBackupPayload,
  sections: Record<ImportSection, ImportSectionCount>
) {
  const now = new Date().toISOString();
  const [existingExercises, existingRoutines] = await Promise.all([
    db.exercises.filter((exercise) => !exercise.deletedAt).toArray(),
    db.routines.filter((routine) => !routine.deletedAt).toArray()
  ]);

  const takenExerciseNames = new Set(existingExercises.map((exercise) => normalizeName(exercise.baseName)));
  const takenRoutineNames = new Set(existingRoutines.map((routine) => routine.name.trim().toLowerCase()));

  const currentSettings = await db.settings.get('app');
  const incomingSettingsTs = normalizeSettingsTimestamp(payload.data.settings);
  const currentSettingsTs = currentSettings ? normalizeSettingsTimestamp(currentSettings) : '';
  if (!currentSettings || incomingSettingsTs > currentSettingsTs) {
    await db.settings.put({
      ...defaultSettings,
      ...payload.data.settings,
      id: 'app',
      settingsUpdatedAt: incomingSettingsTs
    });
    if (currentSettings) {
      sections.settings.merged += 1;
    } else {
      sections.settings.imported += 1;
    }
  } else {
    sections.settings.skipped += 1;
  }

  const sortedCustomExercises = [...payload.data.customExercises].sort((a, b) =>
    a.exercise.id.localeCompare(b.exercise.id)
  );
  for (const bundle of sortedCustomExercises) {
    const existing = await db.exercises.get(bundle.exercise.id);
    const shouldApply =
      !existing ||
      incomingWins(
        bundle.exercise.updatedAt,
        bundle.exercise.deletedAt,
        existing.updatedAt,
        existing.deletedAt
      );
    if (!shouldApply) {
      sections.customExercises.skipped += 1;
      continue;
    }

    if (existing && !existing.deletedAt) {
      takenExerciseNames.delete(normalizeName(existing.baseName));
    }

    const exercise = {
      ...bundle.exercise,
      source: 'custom' as const,
      isCustom: true,
      normalizedName: normalizeName(bundle.exercise.baseName),
      createdAt: bundle.exercise.createdAt ?? now,
      updatedAt: bundle.exercise.updatedAt ?? bundle.exercise.createdAt ?? now
    };

    if (!exercise.deletedAt) {
      const uniqueName = ensureUniqueName(exercise.baseName, takenExerciseNames, normalizeName);
      if (uniqueName !== exercise.baseName) {
        sections.customExercises.renamed += 1;
      }
      exercise.baseName = uniqueName;
      exercise.normalizedName = normalizeName(uniqueName);
    }

    await db.exercises.put(exercise);
    const oldTranslations = await db.exerciseTranslations.where('exerciseId').equals(exercise.id).toArray();
    if (oldTranslations.length) {
      await db.exerciseTranslations.bulkDelete(oldTranslations.map((translation) => translation.id));
    }
    const translations = bundle.translations.length
      ? bundle.translations.map((translation) => ({
          id: `${exercise.id}-${translation.language}`,
          exerciseId: exercise.id,
          language: translation.language,
          name: translation.name
        }))
      : [
          {
            id: `${exercise.id}-es`,
            exerciseId: exercise.id,
            language: 'es',
            name: exercise.baseName
          }
        ];
    await db.exerciseTranslations.bulkPut(translations);

    if (existing) {
      sections.customExercises.merged += 1;
    } else {
      sections.customExercises.imported += 1;
    }
  }

  for (const favorite of payload.data.exerciseFavorites) {
    const existing = await db.exerciseFavorites.get(favorite.exerciseId);
    const shouldApply =
      !existing ||
      incomingWins(favorite.updatedAt, favorite.deletedAt, existing.updatedAt, existing.deletedAt);
    if (!shouldApply) {
      sections.favorites.skipped += 1;
      continue;
    }
    await db.exerciseFavorites.put(favorite);
    if (existing) {
      sections.favorites.merged += 1;
    } else {
      sections.favorites.imported += 1;
    }
  }

  for (const recent of payload.data.exerciseRecents) {
    const existing = await db.exerciseRecents.get(recent.exerciseId);
    const shouldApply = !existing || recent.lastUsedAt > existing.lastUsedAt;
    if (!shouldApply) {
      sections.recents.skipped += 1;
      continue;
    }
    await db.exerciseRecents.put(recent);
    if (existing) {
      sections.recents.merged += 1;
    } else {
      sections.recents.imported += 1;
    }
  }

  const sortedRoutines = [...payload.data.routines].sort((a, b) => a.routine.id.localeCompare(b.routine.id));
  for (const bundle of sortedRoutines) {
    const existing = await db.routines.get(bundle.routine.id);
    const shouldApply =
      !existing ||
      incomingWins(
        bundle.routine.updatedAt,
        bundle.routine.deletedAt,
        existing.updatedAt,
        existing.deletedAt
      );
    if (!shouldApply) {
      sections.routines.skipped += 1;
      continue;
    }

    if (existing && !existing.deletedAt) {
      takenRoutineNames.delete(existing.name.trim().toLowerCase());
    }

    const routine = {
      ...bundle.routine,
      createdAt: bundle.routine.createdAt ?? now,
      updatedAt: bundle.routine.updatedAt ?? bundle.routine.createdAt ?? now
    };
    if (!routine.deletedAt) {
      const uniqueName = ensureUniqueName(
        routine.name,
        takenRoutineNames,
        (value) => value.trim().toLowerCase()
      );
      if (uniqueName !== routine.name) {
        sections.routines.renamed += 1;
      }
      routine.name = uniqueName;
    }

    await db.routines.put(routine);
    await db.routineTags.where('routineId').equals(routine.id).delete();
    await db.routineExercises.where('routineId').equals(routine.id).delete();
    const existingDefaults = await db.exerciseDefaults.where('routineId').equals(routine.id).toArray();
    if (existingDefaults.length) {
      await db.exerciseDefaults.bulkDelete(existingDefaults.map((item) => item.id));
    }
    await db.routineVersions.where('routineId').equals(routine.id).delete();

    if (!routine.deletedAt) {
      const tags = [...new Set(bundle.tags)]
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => ({
          id: `${routine.id}-${tag}`,
          routineId: routine.id,
          tag
        }));
      if (tags.length) {
        await db.routineTags.bulkPut(tags);
      }

      const exercises = [...bundle.exercises].sort((a, b) => a.order - b.order);
      if (exercises.length) {
        await db.routineExercises.bulkPut(
          exercises.map((entry) => ({
            id: `routine-exercise-${crypto.randomUUID()}`,
            routineId: routine.id,
            exerciseId: entry.exerciseId,
            order: entry.order
          }))
        );
        const defaults = exercises
          .filter((entry) => entry.defaults)
          .map((entry) => toRoutineDefaultRecord(routine.id, entry.exerciseId, entry.defaults!));
        if (defaults.length) {
          await db.exerciseDefaults.bulkPut(defaults);
        }
      }
    }

    if (existing) {
      sections.routines.merged += 1;
    } else {
      sections.routines.imported += 1;
    }
  }

  const sortedWorkouts = [...payload.data.workouts].sort((a, b) => a.workout.id.localeCompare(b.workout.id));
  for (const bundle of sortedWorkouts) {
    const existing = await db.workouts.get(bundle.workout.id);
    const shouldApply =
      !existing ||
      incomingWins(
        bundle.workout.updatedAt,
        bundle.workout.deletedAt,
        existing.updatedAt,
        existing.deletedAt
      );
    if (!shouldApply) {
      sections.workouts.skipped += 1;
      continue;
    }

    const workout = {
      ...bundle.workout,
      startedAt: bundle.workout.startedAt ?? now,
      endedAt: bundle.workout.endedAt ?? bundle.workout.startedAt ?? now,
      updatedAt: bundle.workout.updatedAt ?? bundle.workout.endedAt ?? now
    };
    await db.workouts.put(workout);

    const oldWorkoutExercises = await db.workoutExercises.where('workoutId').equals(workout.id).toArray();
    if (oldWorkoutExercises.length) {
      const oldExerciseIds = oldWorkoutExercises.map((entry) => entry.id);
      const oldSets = await db.workoutSets.where('workoutExerciseId').anyOf(oldExerciseIds).toArray();
      if (oldSets.length) {
        await db.workoutSets.bulkDelete(oldSets.map((set) => set.id));
      }
      await db.workoutExercises.bulkDelete(oldExerciseIds);
    }

    if (!workout.deletedAt) {
      for (const exercise of bundle.exercises) {
        const workoutExerciseId = `workout-exercise-${crypto.randomUUID()}`;
        await db.workoutExercises.put({
          id: workoutExerciseId,
          workoutId: workout.id,
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          order: exercise.order,
          notes: exercise.notes
        });
        if (exercise.sets.length) {
          await db.workoutSets.bulkPut(
            exercise.sets.map((set) => ({
              id: `workout-set-${crypto.randomUUID()}`,
              workoutExerciseId,
              order: set.order,
              setType: set.setType,
              weight: set.weight,
              reps: set.reps,
              duration: set.duration,
              distance: set.distance,
              rpe: set.rpe,
              completed: set.completed
            }))
          );
        }
      }
    }

    if (existing) {
      sections.workouts.merged += 1;
    } else {
      sections.workouts.imported += 1;
    }
  }

  for (const series of payload.data.plannedWorkoutSeries) {
    const existing = await db.plannedWorkoutSeries.get(series.id);
    const shouldApply =
      !existing ||
      incomingWins(series.updatedAt, series.deletedAt, existing.updatedAt, existing.deletedAt);
    if (!shouldApply) {
      sections.plannedSeries.skipped += 1;
      continue;
    }
    await db.plannedWorkoutSeries.put(series);
    if (existing) {
      sections.plannedSeries.merged += 1;
    } else {
      sections.plannedSeries.imported += 1;
    }
  }

  for (const occurrence of payload.data.plannedWorkoutOccurrences) {
    const existing = await db.plannedWorkoutOccurrences.get(occurrence.id);
    const shouldApply =
      !existing ||
      incomingWins(
        occurrence.updatedAt,
        occurrence.deletedAt,
        existing.updatedAt,
        existing.deletedAt
      );
    if (!shouldApply) {
      sections.plannedOccurrences.skipped += 1;
      continue;
    }
    await db.plannedWorkoutOccurrences.put(occurrence);
    if (existing) {
      sections.plannedOccurrences.merged += 1;
    } else {
      sections.plannedOccurrences.imported += 1;
    }
  }
}

export async function importFullBackup(
  payload: FullBackupPayload,
  mode: FullBackupImportMode
): Promise<FullBackupImportResult> {
  const sections = createEmptyImportSections();
  const autoBackup = await createPreImportAutoBackup();
  await db.transaction(
    'rw',
    [
      db.settings,
      db.exercises,
      db.exerciseTranslations,
      db.exerciseFavorites,
      db.exerciseRecents,
      db.routines,
      db.routineTags,
      db.routineExercises,
      db.exerciseDefaults,
      db.routineVersions,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.plannedWorkoutSeries,
      db.plannedWorkoutOccurrences,
      db.wrkoutTips
    ],
    async () => {
      if (mode === 'replace') {
        await applyReplace(payload, sections);
      } else {
        await applyMerge(payload, sections);
      }
    }
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('settings-changed'));
  }

  return {
    mode,
    autoBackup,
    sections,
    totals: getTotals(sections)
  };
}

export async function getBackupSnapshot(snapshotId: string) {
  return db.backupSnapshots.get(snapshotId);
}

export async function listBackupSnapshots(limit = AUTO_BACKUP_RETENTION) {
  const snapshots = await db.backupSnapshots.orderBy('createdAt').reverse().toArray();
  return snapshots.slice(0, limit);
}
