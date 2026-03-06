import seedData from './wgerExerciseSeed.json';
import type { ExerciseMetric } from './db';
import { normalizeName } from './normalizeText';
import wgerInfoSnapshot from './wgerExerciseInfoSnapshot.json';

export const CATALOG_NORMALIZATION_VERSION = 2;
export const CATALOG_NORMALIZATION_MARKER_ID = 'catalog-normalization-v1';

type SeedExercise = {
  id: string;
  sourceId?: number;
  baseName: string;
  muscles: string[];
  equipment: string[];
  metricType: ExerciseMetric;
  translations?: Record<string, string | undefined>;
};

type CanonicalSeedExercise = {
  id: string;
  baseName: string;
  muscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  metricType: ExerciseMetric;
  translations: Record<string, string>;
};

type Artifacts = {
  canonicalByLegacyId: Record<string, string>;
  aliasesByCanonicalId: Record<string, string[]>;
  normalizedAliasesByCanonicalId: Record<string, string[]>;
  canonicalSeed: CanonicalSeedExercise[];
};

const seedExercises = seedData.exercises as SeedExercise[];
const snapshotBySourceId = (
  (wgerInfoSnapshot as {
    items?: Record<
      string,
      {
        primaryMuscles?: string[];
        secondaryMuscles?: string[];
        equipment?: string[];
      }
    >;
  }).items ?? {}
);

const CANONICAL_GROUP_OVERRIDES: Record<string, string> = {};

const FAMILY_STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'a', 'al', 'para', 'por']);

const EQUIPMENT_BASE_LABELS: Record<string, string | undefined> = {
  barbell: 'Barra',
  bench: 'Banco',
  dumbbell: 'Mancuernas',
  'incline bench': 'Banco',
  kettlebell: 'Kettlebell',
  'pull-up bar': 'Barra de dominadas',
  'resistance band': 'Banda elastica',
  'sz-bar': 'Barra EZ',
  'swiss ball': 'Fitball',
  'gym mat': undefined,
  'none (bodyweight exercise)': undefined
};

function parseWgerNumericId(exerciseId: string) {
  const match = /^wger-(\d+)$/.exec(exerciseId);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]);
}

function inferEquipmentFromName(name: string) {
  const normalized = normalizeName(name);
  if (!normalized) return [];
  if (/\btrx|suspension\b/.test(normalized)) return ['TRX'];
  if (/\b(cuerda|rope)\b/.test(normalized)) return ['Cuerda'];
  if (/\b(disco|plate)\b/.test(normalized)) return ['Disco'];
  if (/\bsmith\b/.test(normalized)) return ['Maquina Smith'];
  if (/\b(maquina|machine)\b/.test(normalized)) return ['Maquina'];
  if (/\b(cable|polea|jalon|pulldown)\b/.test(normalized)) return ['Cable'];
  if (/\b(mancuerna|dumbbell)\b/.test(normalized)) return ['Mancuernas'];
  if (/\b(barra ez|ez bar|sz-bar)\b/.test(normalized)) return ['Barra EZ'];
  if (/\b(barra|barbell)\b/.test(normalized)) return ['Barra'];
  if (/\b(kettlebell|pesa rusa)\b/.test(normalized)) return ['Kettlebell'];
  if (/\b(banda|band)\b/.test(normalized)) return ['Banda elastica'];
  if (/\b(dominadas|pull-up bar)\b/.test(normalized)) return ['Barra de dominadas'];
  if (/\b(banco|bench|incline|decline)\b/.test(normalized)) return ['Banco'];
  if (/\b(fitball|swiss ball|balon|pelota)\b/.test(normalized)) return ['Fitball'];
  return [];
}

function normalizeEquipmentForRecord(rawEquipment: string[], exerciseName: string) {
  const normalized = [...new Set(
    (rawEquipment ?? [])
      .map((item) => {
        const key = normalizeName(item);
        if (Object.prototype.hasOwnProperty.call(EQUIPMENT_BASE_LABELS, key)) {
          return EQUIPMENT_BASE_LABELS[key];
        }
        return item;
      })
      .filter((item): item is string => Boolean(item))
  )];
  if (normalized.length) {
    return normalized.sort((a, b) => a.localeCompare(b));
  }
  const inferred = inferEquipmentFromName(exerciseName);
  return [...new Set(inferred)].sort((a, b) => a.localeCompare(b));
}

function normalizeEquipmentForKey(equipment: string[]) {
  return [...new Set((equipment ?? []).map((item) => normalizeName(item)).filter(Boolean))].sort().join('|');
}

function buildFamilyKey(name: string) {
  const tokens = normalizeName(name)
    .split(/\s+/)
    .filter((token) => token && !FAMILY_STOP_WORDS.has(token));
  return tokens.join(' ');
}

type EnrichedSeedExercise = SeedExercise & {
  nameEs: string;
  normalizedEquipment: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

function splitMuscles(exercise: SeedExercise, primaryCountHint: number | undefined) {
  const uniqueMuscles = [...new Set((exercise.muscles ?? []).filter(Boolean))];
  if (!uniqueMuscles.length) {
    return { primaryMuscles: [], secondaryMuscles: [] };
  }
  const hintedPrimaryCount =
    typeof primaryCountHint === 'number' && primaryCountHint > 0
      ? Math.min(primaryCountHint, uniqueMuscles.length)
      : 1;
  const primaryMuscles = uniqueMuscles.slice(0, hintedPrimaryCount);
  const secondaryMuscles = uniqueMuscles.slice(hintedPrimaryCount).filter((muscle) => !primaryMuscles.includes(muscle));
  return {
    primaryMuscles,
    secondaryMuscles
  };
}

function enrichSeedExercise(exercise: SeedExercise): EnrichedSeedExercise {
  const nameEs = exercise.translations?.es ?? exercise.baseName;
  const snapshot = exercise.sourceId ? snapshotBySourceId[String(exercise.sourceId)] : undefined;
  const equipment = normalizeEquipmentForRecord(snapshot?.equipment ?? exercise.equipment ?? [], nameEs);
  const { primaryMuscles, secondaryMuscles } = splitMuscles(
    exercise,
    snapshot?.primaryMuscles?.length
  );
  return {
    ...exercise,
    nameEs,
    normalizedEquipment: equipment,
    primaryMuscles,
    secondaryMuscles
  };
}

function buildGroupKey(exercise: EnrichedSeedExercise) {
  const familyKey = buildFamilyKey(exercise.nameEs);
  const equipmentKey = normalizeEquipmentForKey(exercise.normalizedEquipment);
  return `${familyKey}||${exercise.metricType}||${equipmentKey}`;
}

function toTitleCase(name: string) {
  return name
    .split(/\s+/)
    .map((token) => (token ? token[0].toUpperCase() + token.slice(1).toLowerCase() : token))
    .join(' ')
    .trim();
}

function scoreDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return Number.NEGATIVE_INFINITY;
  let score = 0;
  if (/[A-Z]/.test(trimmed) && /[a-z]/.test(trimmed)) score += 2;
  if (trimmed === trimmed.toUpperCase()) score -= 1;
  if (trimmed === trimmed.toLowerCase()) score -= 0.5;
  if (trimmed.length >= 4 && trimmed.length <= 48) score += 0.5;
  if (/[áéíóúñÁÉÍÓÚÑ]/.test(trimmed)) score += 0.25;
  return score;
}

function pickBestName(candidates: string[]) {
  const valid = [...new Set(candidates.map((item) => item.trim()).filter(Boolean))];
  if (!valid.length) return 'Ejercicio';
  const best = [...valid].sort((a, b) => {
    const scoreDiff = scoreDisplayName(b) - scoreDisplayName(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.localeCompare(b);
  })[0];
  if (best === best.toLowerCase() || best === best.toUpperCase()) {
    return toTitleCase(best);
  }
  return best;
}

function scoreCandidateForAttributes(exercise: EnrichedSeedExercise) {
  return (
    exercise.primaryMuscles.length * 4 +
    exercise.secondaryMuscles.length * 2 +
    exercise.normalizedEquipment.length * 2 +
    Object.keys(exercise.translations ?? {}).length
  );
}

function pickBestAttributesCandidate(group: EnrichedSeedExercise[]) {
  const sorted = [...group].sort((a, b) => {
    const scoreDiff = scoreCandidateForAttributes(b) - scoreCandidateForAttributes(a);
    if (scoreDiff !== 0) return scoreDiff;
    return parseWgerNumericId(a.id) - parseWgerNumericId(b.id);
  });
  return sorted[0];
}

function buildMuscleProfile(group: EnrichedSeedExercise[], preferred: EnrichedSeedExercise) {
  const primary = [...preferred.primaryMuscles];
  if (!primary.length) {
    const fallbackPrimary = group.find((entry) => entry.primaryMuscles.length > 0)?.primaryMuscles[0];
    if (fallbackPrimary) {
      primary.push(fallbackPrimary);
    }
  }
  if (!primary.length) {
    const fallbackAny = group.find((entry) => entry.muscles.length > 0)?.muscles[0];
    if (fallbackAny) {
      primary.push(fallbackAny);
    }
  }

  const secondarySet = new Set<string>();
  group.forEach((entry) => {
    entry.secondaryMuscles.forEach((muscle) => {
      if (!primary.includes(muscle)) {
        secondarySet.add(muscle);
      }
    });
  });
  if (!secondarySet.size) {
    group.forEach((entry) => {
      entry.muscles.forEach((muscle) => {
        if (!primary.includes(muscle)) {
          secondarySet.add(muscle);
        }
      });
    });
  }
  return {
    primaryMuscles: primary,
    secondaryMuscles: [...secondarySet]
  };
}

function buildEquipmentProfile(group: EnrichedSeedExercise[], preferred: EnrichedSeedExercise) {
  if (preferred.normalizedEquipment.length) {
    return preferred.normalizedEquipment;
  }
  const fallback = group.find((entry) => entry.normalizedEquipment.length > 0);
  return fallback?.normalizedEquipment ?? [];
}

function buildArtifacts(): Artifacts {
  const enrichedSeed = seedExercises.map((exercise) => enrichSeedExercise(exercise));
  const groups = new Map<string, EnrichedSeedExercise[]>();
  enrichedSeed.forEach((exercise) => {
    const key = buildGroupKey(exercise);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(exercise);
  });

  const canonicalByLegacyId: Record<string, string> = {};
  const aliasesByCanonicalId: Record<string, string[]> = {};
  const normalizedAliasesByCanonicalId: Record<string, string[]> = {};
  const canonicalSeed: CanonicalSeedExercise[] = [];

  groups.forEach((group, key) => {
    const sorted = [...group].sort((a, b) => {
      const aNum = Number.isFinite(a.sourceId) ? (a.sourceId as number) : parseWgerNumericId(a.id);
      const bNum = Number.isFinite(b.sourceId) ? (b.sourceId as number) : parseWgerNumericId(b.id);
      if (aNum !== bNum) return aNum - bNum;
      return a.id.localeCompare(b.id);
    });

    const overrideId = CANONICAL_GROUP_OVERRIDES[key];
    const canonical = sorted.find((item) => item.id === overrideId) ?? sorted[0];
    const canonicalId = canonical.id;
    const bestAttributesCandidate = pickBestAttributesCandidate(sorted);

    const displayNameCandidates = sorted.map((item) => item.nameEs);
    const canonicalBaseName = pickBestName(displayNameCandidates);

    const translationsByLanguage = new Map<string, string[]>();
    sorted.forEach((item) => {
      const candidates = item.translations ?? {};
      Object.entries(candidates).forEach(([language, name]) => {
        if (!name) return;
        if (!translationsByLanguage.has(language)) {
          translationsByLanguage.set(language, []);
        }
        translationsByLanguage.get(language)?.push(name);
      });
      if (!item.translations?.es) {
        if (!translationsByLanguage.has('es')) {
          translationsByLanguage.set('es', []);
        }
        translationsByLanguage.get('es')?.push(item.baseName);
      }
    });

    const translations: Record<string, string> = {};
    translationsByLanguage.forEach((names, language) => {
      const best = pickBestName(names);
      if (best) {
        translations[language] = best;
      }
    });
    translations.es = canonicalBaseName;

    const muscleProfile = buildMuscleProfile(sorted, bestAttributesCandidate);
    const equipment = buildEquipmentProfile(sorted, bestAttributesCandidate);

    canonicalSeed.push({
      id: canonicalId,
      baseName: canonicalBaseName,
      muscles: muscleProfile.primaryMuscles,
      secondaryMuscles: muscleProfile.secondaryMuscles,
      equipment,
      metricType: canonical.metricType,
      translations
    });

    const rawAliases = new Set<string>();
    sorted.forEach((item) => {
      rawAliases.add(item.baseName);
      Object.values(item.translations ?? {})
        .filter((name): name is string => Boolean(name))
        .forEach((name) => rawAliases.add(name));
    });
    rawAliases.add(canonicalBaseName);

    aliasesByCanonicalId[canonicalId] = [...rawAliases]
      .map((item) => item.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    normalizedAliasesByCanonicalId[canonicalId] = [...new Set(aliasesByCanonicalId[canonicalId].map((item) => normalizeName(item)).filter(Boolean))];

    sorted.forEach((item) => {
      canonicalByLegacyId[item.id] = canonicalId;
    });
  });

  canonicalSeed.sort((a, b) => a.baseName.localeCompare(b.baseName));
  return {
    canonicalByLegacyId,
    aliasesByCanonicalId,
    normalizedAliasesByCanonicalId,
    canonicalSeed
  };
}

const artifacts = buildArtifacts();

export function resolveCanonicalExerciseId(exerciseId: string) {
  return artifacts.canonicalByLegacyId[exerciseId] ?? exerciseId;
}

export function getExerciseAliasNames(exerciseId: string) {
  const canonicalId = resolveCanonicalExerciseId(exerciseId);
  return artifacts.aliasesByCanonicalId[canonicalId] ?? [];
}

export function getExerciseSearchAliases(exerciseId: string) {
  const canonicalId = resolveCanonicalExerciseId(exerciseId);
  return artifacts.normalizedAliasesByCanonicalId[canonicalId] ?? [];
}

export function getCanonicalSeedExercises() {
  return artifacts.canonicalSeed.map((item) => ({
    ...item,
    muscles: [...item.muscles],
    secondaryMuscles: [...item.secondaryMuscles],
    equipment: [...item.equipment],
    translations: { ...item.translations }
  }));
}

export function getCatalogNormalizationStats() {
  const total = seedExercises.length;
  const canonical = artifacts.canonicalSeed.length;
  return {
    version: CATALOG_NORMALIZATION_VERSION,
    totalSeedExercises: total,
    canonicalExercises: canonical,
    mergedCount: total - canonical
  };
}
