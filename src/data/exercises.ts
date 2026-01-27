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
  if (existingCount > 0) return;

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
        createdAt: now
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
  const existing = await db.exercises.where('normalizedName').equals(normalizedName).first();
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
    createdAt: now
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
    .filter((exercise) => exercise.id !== id)
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
      metricType
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

export async function toggleFavorite(exerciseId: string) {
  const existing = await db.exerciseFavorites.get(exerciseId);
  if (existing) {
    await db.exerciseFavorites.delete(exerciseId);
    return false;
  }
  await db.exerciseFavorites.put({
    exerciseId,
    createdAt: new Date().toISOString()
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
  return db.exerciseFavorites.orderBy('createdAt').reverse().toArray();
}

export async function listRecents() {
  return db.exerciseRecents.orderBy('lastUsedAt').reverse().toArray();
}
