import {
  CATALOG_NORMALIZATION_MARKER_ID,
  CATALOG_NORMALIZATION_VERSION,
  getCanonicalSeedExercises,
  getExerciseSearchAliases,
  resolveCanonicalExerciseId
} from './catalogNormalization';
import {
  db,
  ExerciseDefaultRecord,
  ExerciseFavoriteRecord,
  ExerciseMetric,
  ExerciseRecentRecord,
  ExerciseRecord,
  ExerciseTranslationRecord,
  RoutineExerciseRecord,
  WorkoutExerciseRecord,
  WrkoutTipRecord
} from './db';
import { normalizeName } from './normalizeText';

export interface ExerciseFilters {
  query?: string;
  muscle?: string;
  equipment?: string;
}

export interface ExerciseWithTranslations extends ExerciseRecord {
  translations: ExerciseTranslationRecord[];
}

const NORMALIZATION_MARKER_VALUE = `v${CATALOG_NORMALIZATION_VERSION}`;

export async function seedExerciseCatalog() {
  const canonicalSeed = getCanonicalSeedExercises();
  const existingCount = await db.exercises.count();
  if (existingCount === 0) {
    await db.transaction('rw', db.exercises, db.exerciseTranslations, async () => {
      const now = new Date().toISOString();
      for (const exercise of canonicalSeed) {
        const record: ExerciseRecord = {
          id: exercise.id,
          baseName: exercise.baseName,
          normalizedName: normalizeName(exercise.baseName),
          muscles: exercise.muscles,
          secondaryMuscles: exercise.secondaryMuscles ?? [],
          equipment: exercise.equipment ?? [],
          metricType: exercise.metricType as ExerciseMetric,
          isCustom: false,
          source: 'wger',
          createdAt: now,
          updatedAt: now
        };
        await db.exercises.add(record);
        const translations = Object.entries(exercise.translations ?? {});
        if (translations.length) {
          const rows: ExerciseTranslationRecord[] = translations.map(([language, name]) => ({
            id: `${exercise.id}-${language}`,
            exerciseId: exercise.id,
            language: language as ExerciseTranslationRecord['language'],
            name
          }));
          await db.exerciseTranslations.bulkAdd(rows);
        }
      }
    });
  } else {
    await repairWgerCatalog(canonicalSeed);
  }

  await normalizeCatalogIfNeeded(canonicalSeed);
}

async function repairWgerCatalog(canonicalSeed: ReturnType<typeof getCanonicalSeedExercises>) {
  const wgerExercises = await db.exercises
    .filter((exercise) => exercise.source === 'wger' && !exercise.deletedAt)
    .toArray();
  if (!wgerExercises.length) return;

  const needsRepair = wgerExercises.some(
    (exercise) =>
      exercise.muscles.length === 0 ||
      exercise.equipment.length === 0 ||
      !Array.isArray(exercise.secondaryMuscles)
  );
  if (!needsRepair) return;

  const seedMap = new Map(canonicalSeed.map((exercise) => [exercise.id, exercise]));

  await db.transaction('rw', db.exercises, db.exerciseTranslations, async () => {
    for (const exercise of wgerExercises) {
      const seed = seedMap.get(exercise.id);
      if (!seed) continue;
      const updatedMuscles = seed.muscles;
      const updatedEquipment = seed.equipment;
      if (!updatedMuscles.length && !updatedEquipment.length) continue;

      await db.exercises.update(exercise.id, {
        baseName: seed.baseName,
        normalizedName: normalizeName(seed.baseName),
        muscles: updatedMuscles,
        secondaryMuscles: seed.secondaryMuscles ?? [],
        equipment: updatedEquipment,
        metricType: seed.metricType as ExerciseMetric,
        updatedAt: exercise.updatedAt ?? exercise.createdAt
      });

      const existingTranslations = await db.exerciseTranslations.where('exerciseId').equals(exercise.id).toArray();
      const existingLanguages = new Set(existingTranslations.map((item) => item.language));
      const missingTranslations: ExerciseTranslationRecord[] = Object.entries(seed.translations ?? {})
        .filter(([language]) => !existingLanguages.has(language))
        .map(([language, name]) => ({
          id: `${exercise.id}-${language}`,
          exerciseId: exercise.id,
          language: language as ExerciseTranslationRecord['language'],
          name
        }));
      if (missingTranslations.length) {
        await db.exerciseTranslations.bulkAdd(missingTranslations);
      }
    }
  });
}

function latestTimestamp(updatedAt?: string, deletedAt?: string) {
  return deletedAt && deletedAt > (updatedAt ?? '') ? deletedAt : updatedAt ?? '';
}

function pickDefaultRecord(
  current: ExerciseDefaultRecord | undefined,
  candidate: ExerciseDefaultRecord
) {
  if (!current) return candidate;
  const currentScore = [
    current.metricTypeOverride,
    current.defaultSetTypes?.length,
    current.defaultSets,
    current.defaultReps,
    current.defaultWeight,
    current.defaultDuration,
    current.defaultDistance,
    current.defaultRestSeconds,
    current.goalMode
  ].filter((value) => value !== undefined && value !== null).length;
  const candidateScore = [
    candidate.metricTypeOverride,
    candidate.defaultSetTypes?.length,
    candidate.defaultSets,
    candidate.defaultReps,
    candidate.defaultWeight,
    candidate.defaultDuration,
    candidate.defaultDistance,
    candidate.defaultRestSeconds,
    candidate.goalMode
  ].filter((value) => value !== undefined && value !== null).length;
  if (candidateScore > currentScore) return candidate;
  if (candidateScore < currentScore) return current;
  return candidate.id.localeCompare(current.id) < 0 ? candidate : current;
}

function mergeFavorite(
  current: ExerciseFavoriteRecord | undefined,
  candidate: ExerciseFavoriteRecord
) {
  if (!current) return candidate;
  return latestTimestamp(candidate.updatedAt, candidate.deletedAt) >
    latestTimestamp(current.updatedAt, current.deletedAt)
    ? candidate
    : current;
}

function mergeTip(current: WrkoutTipRecord | undefined, candidate: WrkoutTipRecord) {
  if (!current) return candidate;
  if (candidate.lastFetchedAt > current.lastFetchedAt) return candidate;
  if (candidate.lastFetchedAt < current.lastFetchedAt) return current;
  const currentHasTip = Boolean(current.summary) || (current.bullets?.length ?? 0) > 0;
  const candidateHasTip = Boolean(candidate.summary) || (candidate.bullets?.length ?? 0) > 0;
  if (candidateHasTip && !currentHasTip) return candidate;
  return current;
}

async function normalizeCatalogIfNeeded(canonicalSeed: ReturnType<typeof getCanonicalSeedExercises>) {
  const marker = await db.syncState.get(CATALOG_NORMALIZATION_MARKER_ID);
  if (marker?.value === NORMALIZATION_MARKER_VALUE) {
    return;
  }

  const now = new Date().toISOString();
  const canonicalSeedById = new Map(canonicalSeed.map((item) => [item.id, item]));

  await db.transaction(
    'rw',
    [
      db.exercises,
      db.exerciseTranslations,
      db.routineExercises,
      db.exerciseDefaults,
      db.workoutExercises,
      db.exerciseFavorites,
      db.exerciseRecents,
      db.wrkoutTips,
      db.syncState
    ],
    async () => {
      const [routineExercises, defaults, workoutExercises, favorites, recents, tips, allExercises] =
        await Promise.all([
          db.routineExercises.toArray(),
          db.exerciseDefaults.toArray(),
          db.workoutExercises.toArray(),
          db.exerciseFavorites.toArray(),
          db.exerciseRecents.toArray(),
          db.wrkoutTips.toArray(),
          db.exercises.toArray()
        ]);

      const normalizedRoutineRows = new Map<string, RoutineExerciseRecord>();
      const routineGroups = new Map<string, RoutineExerciseRecord[]>();
      routineExercises.forEach((entry) => {
        if (!routineGroups.has(entry.routineId)) {
          routineGroups.set(entry.routineId, []);
        }
        routineGroups.get(entry.routineId)?.push(entry);
      });
      routineGroups.forEach((entries) => {
        const sorted = [...entries].sort((a, b) => a.order - b.order);
        const seen = new Set<string>();
        let nextOrder = 0;
        sorted.forEach((entry) => {
          const canonicalId = resolveCanonicalExerciseId(entry.exerciseId);
          if (seen.has(canonicalId)) return;
          seen.add(canonicalId);
          normalizedRoutineRows.set(entry.id, {
            ...entry,
            exerciseId: canonicalId,
            order: nextOrder
          });
          nextOrder += 1;
        });
      });
      await db.routineExercises.clear();
      if (normalizedRoutineRows.size) {
        await db.routineExercises.bulkPut([...normalizedRoutineRows.values()]);
      }

      const defaultByKey = new Map<string, ExerciseDefaultRecord>();
      defaults.forEach((entry) => {
        const canonicalId = resolveCanonicalExerciseId(entry.exerciseId);
        const key = `${entry.routineId}::${canonicalId}`;
        const normalized = { ...entry, exerciseId: canonicalId };
        defaultByKey.set(key, pickDefaultRecord(defaultByKey.get(key), normalized));
      });
      await db.exerciseDefaults.clear();
      if (defaultByKey.size) {
        await db.exerciseDefaults.bulkPut([...defaultByKey.values()]);
      }

      const normalizedWorkoutExercises: WorkoutExerciseRecord[] = workoutExercises.map((entry) => ({
        ...entry,
        exerciseId: resolveCanonicalExerciseId(entry.exerciseId)
      }));
      await db.workoutExercises.bulkPut(normalizedWorkoutExercises);

      const favoriteById = new Map<string, ExerciseFavoriteRecord>();
      favorites.forEach((entry) => {
        const canonicalId = resolveCanonicalExerciseId(entry.exerciseId);
        const normalized = { ...entry, exerciseId: canonicalId };
        favoriteById.set(canonicalId, mergeFavorite(favoriteById.get(canonicalId), normalized));
      });
      await db.exerciseFavorites.clear();
      if (favoriteById.size) {
        await db.exerciseFavorites.bulkPut([...favoriteById.values()]);
      }

      const recentById = new Map<string, ExerciseRecentRecord>();
      recents.forEach((entry) => {
        const canonicalId = resolveCanonicalExerciseId(entry.exerciseId);
        const current = recentById.get(canonicalId);
        if (!current || entry.lastUsedAt > current.lastUsedAt) {
          recentById.set(canonicalId, { ...entry, exerciseId: canonicalId });
        }
      });
      await db.exerciseRecents.clear();
      if (recentById.size) {
        await db.exerciseRecents.bulkPut([...recentById.values()]);
      }

      const tipsById = new Map<string, WrkoutTipRecord>();
      tips.forEach((entry) => {
        const canonicalId = resolveCanonicalExerciseId(entry.exerciseId);
        const normalized = { ...entry, exerciseId: canonicalId };
        tipsById.set(canonicalId, mergeTip(tipsById.get(canonicalId), normalized));
      });
      await db.wrkoutTips.clear();
      if (tipsById.size) {
        await db.wrkoutTips.bulkPut([...tipsById.values()]);
      }

      const existingById = new Map(allExercises.map((exercise) => [exercise.id, exercise]));
      const canonicalExerciseRows: ExerciseRecord[] = canonicalSeed.map((seed) => {
        const existing = existingById.get(seed.id);
        return {
          id: seed.id,
          baseName: seed.baseName,
          normalizedName: normalizeName(seed.baseName),
          muscles: seed.muscles,
          secondaryMuscles: seed.secondaryMuscles ?? [],
          equipment: seed.equipment,
          metricType: seed.metricType,
          isCustom: false,
          source: 'wger',
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          deletedAt: undefined
        };
      });
      await db.exercises.bulkPut(canonicalExerciseRows);

      const staleWgerIds = allExercises
        .filter(
          (exercise) =>
            exercise.source === 'wger' &&
            !exercise.isCustom &&
            resolveCanonicalExerciseId(exercise.id) !== exercise.id
        )
        .map((exercise) => exercise.id);
      if (staleWgerIds.length) {
        await db.exercises.bulkDelete(staleWgerIds);
      }

      const wgerTranslations = await db.exerciseTranslations
        .filter((item) => item.exerciseId.startsWith('wger-'))
        .toArray();
      if (wgerTranslations.length) {
        await db.exerciseTranslations.bulkDelete(wgerTranslations.map((item) => item.id));
      }

      const canonicalTranslations: ExerciseTranslationRecord[] = [];
      canonicalSeed.forEach((entry) => {
        Object.entries(entry.translations ?? {}).forEach(([language, name]) => {
          canonicalTranslations.push({
            id: `${entry.id}-${language}`,
            exerciseId: entry.id,
            language: language as ExerciseTranslationRecord['language'],
            name
          });
        });
      });
      if (canonicalTranslations.length) {
        await db.exerciseTranslations.bulkPut(canonicalTranslations);
      }

      await db.syncState.put({
        id: CATALOG_NORMALIZATION_MARKER_ID,
        value: NORMALIZATION_MARKER_VALUE,
        updatedAt: now
      });
    }
  );
}

export async function listExercises(filters: ExerciseFilters = {}) {
  const { query, muscle, equipment } = filters;
  const normalizedQuery = query ? normalizeName(query) : '';
  let collection = db.exercises.toCollection().filter((exercise) => !exercise.deletedAt);
  if (muscle) {
    collection = collection.filter(
      (exercise) =>
        exercise.muscles.includes(muscle) ||
        (exercise.secondaryMuscles ?? []).includes(muscle)
    );
  }
  if (equipment) {
    collection = collection.filter((exercise) => exercise.equipment.includes(equipment));
  }
  let exercises = await collection.sortBy('baseName');
  const translations = exercises.length
    ? await db.exerciseTranslations
        .where('exerciseId')
        .anyOf(exercises.map((exercise) => exercise.id))
        .toArray()
    : [];
  const translationsByExercise = translations.reduce<Record<string, ExerciseTranslationRecord[]>>(
    (acc, translation) => {
      acc[translation.exerciseId] = acc[translation.exerciseId] || [];
      acc[translation.exerciseId].push(translation);
      return acc;
    },
    {}
  );
  if (normalizedQuery) {
    exercises = exercises.filter((exercise) => {
      if (exercise.normalizedName.includes(normalizedQuery)) {
        return true;
      }
      const aliases = getExerciseSearchAliases(exercise.id);
      if (aliases.some((alias) => alias.includes(normalizedQuery))) {
        return true;
      }
      const exerciseTranslations = translationsByExercise[exercise.id] || [];
      return exerciseTranslations.some((translation) =>
        normalizeName(translation.name).includes(normalizedQuery)
      );
    });
  }
  return exercises.map((exercise) => ({
    ...exercise,
    translations: translationsByExercise[exercise.id] || []
  }));
}

export function getExerciseDisplayName(exercise: ExerciseWithTranslations, language = 'es') {
  const translation =
    exercise.translations.find((item) => item.language === language) ||
    exercise.translations.find((item) => item.language === 'es') ||
    exercise.translations.find((item) => item.language === 'en');
  return translation?.name ?? exercise.baseName;
}

export async function getExerciseById(exerciseId: string) {
  const canonicalExerciseId = resolveCanonicalExerciseId(exerciseId);
  const exercise = await db.exercises.get(canonicalExerciseId);
  if (!exercise || exercise.deletedAt) return null;
  const translations = await db.exerciseTranslations
    .where('exerciseId')
    .equals(canonicalExerciseId)
    .toArray();
  return {
    ...exercise,
    translations
  };
}

export async function createCustomExercise({
  name,
  muscles,
  equipment,
  metricType
}: {
  name: string;
  muscles: string[];
  equipment: string[];
  metricType: ExerciseMetric;
}) {
  const normalizedName = normalizeName(name);
  const existing = await db.exercises
    .where('normalizedName')
    .equals(normalizedName)
    .filter((exercise) => !exercise.deletedAt)
    .first();
  if (existing) {
    throw new Error('duplicate-name');
  }
  const now = new Date().toISOString();
  const id = `custom-${crypto.randomUUID()}`;
  const record: ExerciseRecord = {
    id,
    baseName: name,
    normalizedName,
    muscles,
    secondaryMuscles: [],
    equipment,
    metricType,
    isCustom: true,
    source: 'custom',
    createdAt: now,
    updatedAt: now
  };
  await db.transaction('rw', db.exercises, db.exerciseTranslations, async () => {
    await db.exercises.add(record);
    await db.exerciseTranslations.add({
      id: `${id}-es`,
      exerciseId: id,
      language: 'es',
      name
    });
  });
  return record;
}

export async function updateCustomExercise({
  id,
  name,
  muscles,
  equipment,
  metricType
}: {
  id: string;
  name: string;
  muscles: string[];
  equipment: string[];
  metricType: ExerciseMetric;
}) {
  const normalizedName = normalizeName(name);
  const duplicate = await db.exercises
    .where('normalizedName')
    .equals(normalizedName)
    .filter((exercise) => exercise.id !== id && !exercise.deletedAt)
    .first();
  if (duplicate) {
    throw new Error('duplicate-name');
  }
  await db.transaction('rw', db.exercises, db.exerciseTranslations, async () => {
    await db.exercises.update(id, {
      baseName: name,
      normalizedName,
      muscles,
      secondaryMuscles: [],
      equipment,
      metricType,
      updatedAt: new Date().toISOString()
    });
    const translation = await db.exerciseTranslations
      .where({ exerciseId: id, language: 'es' })
      .first();
    if (translation) {
      await db.exerciseTranslations.update(translation.id, { name });
    } else {
      await db.exerciseTranslations.add({
        id: `${id}-es`,
        exerciseId: id,
        language: 'es',
        name
      });
    }
  });
}

export async function deleteCustomExercise(exerciseId: string) {
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise || !exercise.isCustom || exercise.deletedAt) return;
  const now = new Date().toISOString();
  await db.transaction(
    'rw',
    [
      db.exercises,
      db.exerciseTranslations,
      db.exerciseFavorites,
      db.exerciseRecents,
      db.routineExercises,
      db.exerciseDefaults,
      db.routines
    ],
    async () => {
      await db.exercises.update(exerciseId, {
        deletedAt: now,
        updatedAt: now
      });
      const favorite = await db.exerciseFavorites.get(exerciseId);
      if (favorite) {
        await db.exerciseFavorites.put({
          ...favorite,
          updatedAt: now,
          deletedAt: now
        });
      }
      await db.exerciseRecents.delete(exerciseId);
      const routineExercises = await db.routineExercises
        .where('exerciseId')
        .equals(exerciseId)
        .toArray();
      if (routineExercises.length) {
        const routineIds = Array.from(new Set(routineExercises.map((item) => item.routineId)));
        await db.routineExercises.bulkDelete(routineExercises.map((item) => item.id));
        await Promise.all(
          routineIds.map((routineId) =>
            db.routines.update(routineId, {
              updatedAt: now
            })
          )
        );
      }
      const defaults = await db.exerciseDefaults
        .where('exerciseId')
        .equals(exerciseId)
        .toArray();
      if (defaults.length) {
        await db.exerciseDefaults.bulkDelete(defaults.map((item) => item.id));
      }
    }
  );
}

export async function toggleFavorite(exerciseId: string) {
  const canonicalExerciseId = resolveCanonicalExerciseId(exerciseId);
  const now = new Date().toISOString();
  const existing = await db.exerciseFavorites.get(canonicalExerciseId);
  if (existing && !existing.deletedAt) {
    await db.exerciseFavorites.put({
      ...existing,
      updatedAt: now,
      deletedAt: now
    });
    return false;
  }
  await db.exerciseFavorites.put({
    exerciseId: canonicalExerciseId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: undefined
  });
  return true;
}

export async function recordRecent(exerciseId: string) {
  const canonicalExerciseId = resolveCanonicalExerciseId(exerciseId);
  await db.exerciseRecents.put({
    exerciseId: canonicalExerciseId,
    lastUsedAt: new Date().toISOString()
  });
}

export { normalizeName } from './normalizeText';

export async function listFavorites() {
  const favorites = await db.exerciseFavorites.orderBy('updatedAt').reverse().toArray();
  return favorites.filter((favorite) => !favorite.deletedAt);
}

export async function listRecents() {
  return db.exerciseRecents.orderBy('lastUsedAt').reverse().toArray();
}
