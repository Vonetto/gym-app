import Dexie, { Table } from 'dexie';

export interface SettingsRecord {
  id: 'app';
  settingsUpdatedAt?: string;
  theme: 'dark' | 'light';
  language: 'es';
  units: 'kg';
  statsRangeDays?: 7 | 30 | 180 | 365;
  wrkoutApiKey?: string;
  notificationSettingsUpdatedAt?: string;
  notificationTimezone?: string;
  notificationsEnabled?: boolean;
  plannedWorkoutNotificationsEnabled?: boolean;
  restFinishedNotificationsEnabled?: boolean;
  backgroundSessionNotificationsEnabled?: boolean;
  plannedReminderTime?: string;
  plannedReminderOffsetMinutes?: number;
  backgroundSessionReminderDelayMinutes?: number;
}

export interface RoutineRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  order: number;
  deletedAt?: string;
}

export type ExerciseMetric = 'weight_reps' | 'reps' | 'time' | 'distance';
export type ExerciseGoalMode = 'auto' | 'strength' | 'hypertrophy' | 'endurance';
export type AdvancedSetType = 'normal' | 'warmup' | 'drop' | 'failure' | 'amrap';
export type PlannedWorkoutSeriesKind = 'once' | 'weekly' | 'weekdays';
export type PlannedWorkoutStatus = 'pending' | 'completed' | 'omitted';

export interface ExerciseRecord {
  id: string;
  baseName: string;
  normalizedName: string;
  muscles: string[];
  secondaryMuscles?: string[];
  equipment: string[];
  metricType: ExerciseMetric;
  isCustom: boolean;
  source: 'wger' | 'custom';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ExerciseTranslationRecord {
  id: string;
  exerciseId: string;
  language: string;
  name: string;
}

export interface RoutineExerciseRecord {
  id: string;
  routineId: string;
  exerciseId: string;
  order: number;
}

export interface RoutineTagRecord {
  id: string;
  routineId: string;
  tag: string;
}

export interface ExerciseDefaultRecord {
  id: string;
  routineId: string;
  exerciseId: string;
  metricTypeOverride?: ExerciseMetric;
  defaultSetTypes?: AdvancedSetType[];
  defaultSets?: number;
  defaultReps?: number;
  defaultWeight?: number;
  defaultDuration?: number;
  defaultDistance?: number;
  defaultRestSeconds?: number;
  goalMode?: ExerciseGoalMode;
}

export interface ExerciseFavoriteRecord {
  exerciseId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ExerciseRecentRecord {
  exerciseId: string;
  lastUsedAt: string;
}

export interface RoutineVersionRecord {
  id: string;
  routineId: string;
  createdAt: string;
  name: string;
  snapshot: string;
}

export interface WorkoutRecord {
  id: string;
  routineId?: string;
  routineName?: string;
  tags?: string[];
  startedAt: string;
  endedAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WorkoutExerciseRecord {
  id: string;
  workoutId: string;
  exerciseId: string;
  name: string;
  order: number;
  notes?: string;
}

export interface WorkoutSetRecord {
  id: string;
  workoutExerciseId: string;
  order: number;
  setType?: AdvancedSetType;
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  rpe?: number;
  completed: boolean;
}

export interface WrkoutTipRecord {
  exerciseId: string;
  wrkoutId?: string;
  summary?: string;
  bullets?: string[];
  lastFetchedAt: string;
}

export interface SyncStateRecord {
  id: string;
  status?: 'idle' | 'syncing' | 'success' | 'error' | 'offline-pending';
  lastAttemptAt?: string;
  lastSyncedAt?: string;
  lastError?: string;
  cursor?: string;
  value?: string;
  updatedAt: string;
}

export interface BackupSnapshotRecord {
  id: string;
  kind: 'pre-import';
  createdAt: string;
  schemaVersion: number;
  payload: string;
}

export interface PlannedWorkoutSeriesRecord {
  id: string;
  routineId: string;
  kind: PlannedWorkoutSeriesKind;
  startDate: string;
  weekdays?: number[];
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PlannedWorkoutOccurrenceRecord {
  id: string;
  seriesId: string;
  occurrenceDate: string;
  status: PlannedWorkoutStatus;
  workoutId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

class AppDB extends Dexie {
  settings!: Table<SettingsRecord, 'app'>;
  routines!: Table<RoutineRecord, string>;
  exercises!: Table<ExerciseRecord, string>;
  exerciseTranslations!: Table<ExerciseTranslationRecord, string>;
  routineExercises!: Table<RoutineExerciseRecord, string>;
  routineTags!: Table<RoutineTagRecord, string>;
  exerciseDefaults!: Table<ExerciseDefaultRecord, string>;
  exerciseFavorites!: Table<ExerciseFavoriteRecord, string>;
  exerciseRecents!: Table<ExerciseRecentRecord, string>;
  routineVersions!: Table<RoutineVersionRecord, string>;
  workouts!: Table<WorkoutRecord, string>;
  workoutExercises!: Table<WorkoutExerciseRecord, string>;
  workoutSets!: Table<WorkoutSetRecord, string>;
  wrkoutTips!: Table<WrkoutTipRecord, string>;
  syncState!: Table<SyncStateRecord, string>;
  backupSnapshots!: Table<BackupSnapshotRecord, string>;
  plannedWorkoutSeries!: Table<PlannedWorkoutSeriesRecord, string>;
  plannedWorkoutOccurrences!: Table<PlannedWorkoutOccurrenceRecord, string>;

  constructor() {
    super('gym-tracker');
    this.version(1).stores({
      settings: 'id',
      routines: 'id'
    });
    this.version(2)
      .stores({
        settings: 'id',
        routines: 'id, order, updatedAt, createdAt',
        exercises: 'id, baseName, normalizedName, *muscles, *equipment, isCustom',
        exerciseTranslations: 'id, exerciseId, language, name',
        routineExercises: 'id, routineId, exerciseId, [routineId+order]',
        routineTags: 'id, routineId, tag, [routineId+tag]',
        exerciseDefaults: 'id, routineId, exerciseId, [routineId+exerciseId]',
        exerciseFavorites: 'exerciseId, createdAt',
        exerciseRecents: 'exerciseId, lastUsedAt',
        routineVersions: 'id, routineId, createdAt',
        workouts: 'id, routineId, startedAt, endedAt',
        workoutExercises: 'id, workoutId, exerciseId, [workoutId+order]',
        workoutSets: 'id, workoutExerciseId, [workoutExerciseId+order]'
      })
      .upgrade(async (tx) => {
        const routineTable = tx.table<RoutineRecord, string>('routines');
        const routines = await routineTable.toArray();
        const sorted = routines.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        await Promise.all(
          sorted.map((routine, index) =>
            routineTable.update(routine.id, {
              updatedAt: routine.updatedAt ?? routine.createdAt,
              order: routine.order ?? index
            })
          )
        );
      });
    this.version(3).stores({
      settings: 'id',
      routines: 'id, order, updatedAt, createdAt',
      exercises: 'id, baseName, normalizedName, *muscles, *equipment, isCustom',
      exerciseTranslations: 'id, exerciseId, language, name',
      routineExercises: 'id, routineId, exerciseId, [routineId+order]',
      routineTags: 'id, routineId, tag, [routineId+tag]',
      exerciseDefaults: 'id, routineId, exerciseId, [routineId+exerciseId]',
      exerciseFavorites: 'exerciseId, createdAt',
      exerciseRecents: 'exerciseId, lastUsedAt',
      routineVersions: 'id, routineId, createdAt',
      workouts: 'id, routineId, startedAt, endedAt',
      workoutExercises: 'id, workoutId, exerciseId, [workoutId+order]',
      workoutSets: 'id, workoutExerciseId, [workoutExerciseId+order]',
      wrkoutTips: 'exerciseId, wrkoutId, lastFetchedAt'
    });
    this.version(4)
      .stores({
        settings: 'id',
        routines: 'id, order, updatedAt, deletedAt, createdAt',
        exercises: 'id, baseName, normalizedName, updatedAt, deletedAt, *muscles, *equipment, isCustom, source',
        exerciseTranslations: 'id, exerciseId, language, name',
        routineExercises: 'id, routineId, exerciseId, [routineId+order]',
        routineTags: 'id, routineId, tag, [routineId+tag]',
        exerciseDefaults: 'id, routineId, exerciseId, [routineId+exerciseId]',
        exerciseFavorites: 'exerciseId, createdAt, updatedAt, deletedAt',
        exerciseRecents: 'exerciseId, lastUsedAt',
        routineVersions: 'id, routineId, createdAt',
        workouts: 'id, routineId, startedAt, endedAt, updatedAt, deletedAt',
        workoutExercises: 'id, workoutId, exerciseId, [workoutId+order]',
        workoutSets: 'id, workoutExerciseId, [workoutExerciseId+order]',
        wrkoutTips: 'exerciseId, wrkoutId, lastFetchedAt',
        syncState: 'id, updatedAt, lastSyncedAt, status'
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        await tx.table<RoutineRecord, string>('routines').toCollection().modify((routine) => {
          routine.updatedAt = routine.updatedAt ?? routine.createdAt ?? now;
        });
        await tx.table<ExerciseRecord, string>('exercises').toCollection().modify((exercise) => {
          exercise.updatedAt = exercise.updatedAt ?? exercise.createdAt ?? now;
        });
        await tx
          .table<ExerciseFavoriteRecord, string>('exerciseFavorites')
          .toCollection()
          .modify((favorite) => {
            favorite.updatedAt = favorite.updatedAt ?? favorite.createdAt ?? now;
          });
        await tx.table<WorkoutRecord, string>('workouts').toCollection().modify((workout) => {
          workout.updatedAt = workout.updatedAt ?? workout.endedAt ?? workout.startedAt ?? now;
        });
      });
    this.version(5).stores({
      settings: 'id',
      routines: 'id, order, updatedAt, deletedAt, createdAt',
      exercises: 'id, baseName, normalizedName, updatedAt, deletedAt, *muscles, *equipment, isCustom, source',
      exerciseTranslations: 'id, exerciseId, language, name',
      routineExercises: 'id, routineId, exerciseId, [routineId+order]',
      routineTags: 'id, routineId, tag, [routineId+tag]',
      exerciseDefaults: 'id, routineId, exerciseId, [routineId+exerciseId]',
      exerciseFavorites: 'exerciseId, createdAt, updatedAt, deletedAt',
      exerciseRecents: 'exerciseId, lastUsedAt',
      routineVersions: 'id, routineId, createdAt',
      workouts: 'id, routineId, startedAt, endedAt, updatedAt, deletedAt',
      workoutExercises: 'id, workoutId, exerciseId, [workoutId+order]',
      workoutSets: 'id, workoutExerciseId, [workoutExerciseId+order]',
      wrkoutTips: 'exerciseId, wrkoutId, lastFetchedAt',
      syncState: 'id, updatedAt, lastSyncedAt, status'
    });
    this.version(6).stores({
      settings: 'id',
      routines: 'id, order, updatedAt, deletedAt, createdAt',
      exercises: 'id, baseName, normalizedName, updatedAt, deletedAt, *muscles, *equipment, isCustom, source',
      exerciseTranslations: 'id, exerciseId, language, name',
      routineExercises: 'id, routineId, exerciseId, [routineId+order]',
      routineTags: 'id, routineId, tag, [routineId+tag]',
      exerciseDefaults: 'id, routineId, exerciseId, [routineId+exerciseId]',
      exerciseFavorites: 'exerciseId, createdAt, updatedAt, deletedAt',
      exerciseRecents: 'exerciseId, lastUsedAt',
      routineVersions: 'id, routineId, createdAt',
      workouts: 'id, routineId, startedAt, endedAt, updatedAt, deletedAt',
      workoutExercises: 'id, workoutId, exerciseId, [workoutId+order]',
      workoutSets: 'id, workoutExerciseId, [workoutExerciseId+order]',
      wrkoutTips: 'exerciseId, wrkoutId, lastFetchedAt',
      syncState: 'id, updatedAt, lastSyncedAt, status',
      plannedWorkoutSeries: 'id, routineId, kind, startDate, endDate, updatedAt, deletedAt',
      plannedWorkoutOccurrences:
        'id, seriesId, occurrenceDate, status, workoutId, updatedAt, deletedAt, [seriesId+occurrenceDate]'
    });
    this.version(7).stores({
      settings: 'id',
      routines: 'id, order, updatedAt, deletedAt, createdAt',
      exercises: 'id, baseName, normalizedName, updatedAt, deletedAt, *muscles, *equipment, isCustom, source',
      exerciseTranslations: 'id, exerciseId, language, name',
      routineExercises: 'id, routineId, exerciseId, [routineId+order]',
      routineTags: 'id, routineId, tag, [routineId+tag]',
      exerciseDefaults: 'id, routineId, exerciseId, [routineId+exerciseId]',
      exerciseFavorites: 'exerciseId, createdAt, updatedAt, deletedAt',
      exerciseRecents: 'exerciseId, lastUsedAt',
      routineVersions: 'id, routineId, createdAt',
      workouts: 'id, routineId, startedAt, endedAt, updatedAt, deletedAt',
      workoutExercises: 'id, workoutId, exerciseId, [workoutId+order]',
      workoutSets: 'id, workoutExerciseId, [workoutExerciseId+order]',
      wrkoutTips: 'exerciseId, wrkoutId, lastFetchedAt',
      syncState: 'id, updatedAt, lastSyncedAt, status',
      backupSnapshots: 'id, kind, createdAt',
      plannedWorkoutSeries: 'id, routineId, kind, startDate, endDate, updatedAt, deletedAt',
      plannedWorkoutOccurrences:
        'id, seriesId, occurrenceDate, status, workoutId, updatedAt, deletedAt, [seriesId+occurrenceDate]'
    });
  }
}

export const db = new AppDB();

const LOCAL_STORAGE_KEYS = ['active-session', 'gym-theme'];

export async function resetAll() {
  await db.delete();
  await db.open();
  LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}
