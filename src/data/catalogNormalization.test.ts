import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getCanonicalSeedExercises,
  getCatalogNormalizationStats,
  getExerciseSearchAliases,
  resolveCanonicalExerciseId
} from './catalogNormalization';
import { db } from './db';
import { recordRecent, seedExerciseCatalog, toggleFavorite } from './exercises';
import { closeTestDb, resetTestDb } from '../test/dbTestUtils';

describe('catalog normalization', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(async () => {
    await closeTestDb();
  });

  it('maps known legacy duplicates to a single canonical id', () => {
    const canonicalA = resolveCanonicalExerciseId('wger-1757');
    const canonicalB = resolveCanonicalExerciseId('wger-1762');
    expect(canonicalA).toBe(canonicalB);
    expect(canonicalA).toBe('wger-1757');

    expect(resolveCanonicalExerciseId('wger-379')).toBe('wger-129');
    expect(resolveCanonicalExerciseId('wger-591')).toBe('wger-167');
  });

  it('builds canonical seed with fewer entries than raw source', () => {
    const stats = getCatalogNormalizationStats();
    expect(stats.totalSeedExercises).toBeGreaterThan(stats.canonicalExercises);
    const canonicalSeed = getCanonicalSeedExercises();
    expect(canonicalSeed).toHaveLength(stats.canonicalExercises);
    const abdominales = canonicalSeed.find((entry) => entry.id === 'wger-167');
    expect(abdominales?.secondaryMuscles).toContain('Serratus anterior');
    expect(abdominales?.equipment).toEqual([]);
  });

  it('normalizes favorites and recents to canonical ids', async () => {
    await seedExerciseCatalog();

    await recordRecent('wger-1762');
    await toggleFavorite('wger-1762');

    const recents = await db.exerciseRecents.toArray();
    const favorites = await db.exerciseFavorites.toArray();

    expect(recents[0]?.exerciseId).toBe('wger-1757');
    expect(favorites[0]?.exerciseId).toBe('wger-1757');

    const aliases = getExerciseSearchAliases('wger-1762');
    expect(aliases).toContain('supino');
  }, 15000);
});
