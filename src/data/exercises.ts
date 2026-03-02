import seedData from './wgerExerciseSeed.json';
import { db, ExerciseMetric, ExerciseRecord, ExerciseTranslationRecord } from './db';

export interface ExerciseFilters {
  query?: string;
  muscle?: string;
  equipment?: string;
}

export interface ExerciseWithTranslations extends ExerciseRecord {
  translations: ExerciseTranslationRecord[];
}

const diacriticRegex = /\p{Diacritic}/gu;

export function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(diacriticRegex, '');
}

export async function seedExerciseCatalog() {
  const existingCount = await db.exercises.count();
  if (existingCount === 0) {
    await db.transaction('rw', db.exercises, db.exerciseTranslations, async () => {
      const now = new Date().toISOString();
      for (const exercise of seedData.exercises) {
        const record: ExerciseRecord = {
          id: exercise.id,
          baseName: exercise.baseName,
          normalizedName: normalizeName(exercise.baseName),
          muscles: exercise.muscles,
          equipment: exercise.equipment,
          metricType: exercise.metricType as ExerciseMetric,
          isCustom: false,
          source: 'wger',
          createdAt: now,
          updatedAt: now
        };
        await db.exercises.add(record);
        const translations: ExerciseTranslationRecord[] = Object.entries(exercise.translations).map(
          ([language, name]) => ({
            id: `${exercise.id}-${language}`,
            exerciseId: exercise.id,
            language: language as ExerciseTranslationRecord['language'],
            name
          })
        );
        await db.exerciseTranslations.bulkAdd(translations);
      }
    });
    return;
  }

  await repairWgerCatalog();
}

async function repairWgerCatalog() {
  const wgerExercises = await db.exercises
    .filter((exercise) => exercise.source === 'wger' && !exercise.deletedAt)
    .toArray();
  if (!wgerExercises.length) return;

  const needsRepair = wgerExercises.some(
    (exercise) => exercise.muscles.length === 0 || exercise.equipment.length === 0
  );
  if (!needsRepair) return;

  const seedMap = new Map(seedData.exercises.map((exercise) => [exercise.id, exercise]));

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
        equipment: updatedEquipment,
        metricType: seed.metricType as ExerciseMetric,
        updatedAt: exercise.updatedAt ?? exercise.createdAt
      });

      const existingTranslations = await db.exerciseTranslations
        .where('exerciseId')
        .equals(exercise.id)
        .toArray();
      const existingLanguages = new Set(existingTranslations.map((item) => item.language));
      const missingTranslations: ExerciseTranslationRecord[] = Object.entries(seed.translations)
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

export async function listExercises(filters: ExerciseFilters = {}) {
  const { query, muscle, equipment } = filters;
  const normalizedQuery = query ? normalizeName(query) : '';
  let collection = db.exercises.toCollection();
  if (muscle) {
    collection = db.exercises.where('muscles').equals(muscle);
  }
  if (equipment) {
    collection = collection.filter((exercise) => exercise.equipment.includes(equipment));
  }
  collection = collection.filter((exercise) => !exercise.deletedAt);
  if (normalizedQuery) {
    collection = collection.filter((exercise) =>
      exercise.normalizedName.includes(normalizedQuery)
    );
  }
  const exercises = await collection.sortBy('baseName');
  const translations = await db.exerciseTranslations
    .where('exerciseId')
    .anyOf(exercises.map((exercise) => exercise.id))
    .toArray();
  const translationsByExercise = translations.reduce<Record<string, ExerciseTranslationRecord[]>>(
    (acc, translation) => {
      acc[translation.exerciseId] = acc[translation.exerciseId] || [];
      acc[translation.exerciseId].push(translation);
      return acc;
    },
    {}
  );
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
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise || exercise.deletedAt) return null;
  const translations = await db.exerciseTranslations
    .where('exerciseId')
    .equals(exerciseId)
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
  const now = new Date().toISOString();
  const existing = await db.exerciseFavorites.get(exerciseId);
  if (existing && !existing.deletedAt) {
    await db.exerciseFavorites.put({
      ...existing,
      updatedAt: now,
      deletedAt: now
    });
    return false;
  }
  await db.exerciseFavorites.put({
    exerciseId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: undefined
  });
  return true;
}

export async function recordRecent(exerciseId: string) {
  await db.exerciseRecents.put({
    exerciseId,
    lastUsedAt: new Date().toISOString()
  });
}

export async function listFavorites() {
  const favorites = await db.exerciseFavorites.orderBy('updatedAt').reverse().toArray();
  return favorites.filter((favorite) => !favorite.deletedAt);
}

export async function listRecents() {
  return db.exerciseRecents.orderBy('lastUsedAt').reverse().toArray();
}
