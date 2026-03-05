import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from './db';
import { countLocalSyncItems, syncConflictHelpers } from './sync';
import { closeTestDb, resetTestDb } from '../test/dbTestUtils';

describe('sync conflict helpers', () => {
  it('uses deletedAt as latest timestamp when delete is newer', () => {
    const latest = syncConflictHelpers.latestTs(
      '2026-03-05T10:00:00.000Z',
      '2026-03-05T11:00:00.000Z'
    );
    expect(latest).toBe('2026-03-05T11:00:00.000Z');
  });

  it('pushes local row when local timestamp is newer', () => {
    const shouldPush = syncConflictHelpers.shouldPush(
      '2026-03-05T11:00:00.000Z',
      undefined,
      '2026-03-05T10:00:00.000Z',
      null
    );
    expect(shouldPush).toBe(true);
  });

  it('applies remote row when remote delete is newer', () => {
    const shouldApplyRemote = syncConflictHelpers.shouldApplyRemote(
      '2026-03-05T10:00:00.000Z',
      undefined,
      '2026-03-05T09:00:00.000Z',
      '2026-03-05T12:00:00.000Z'
    );
    expect(shouldApplyRemote).toBe(true);
  });
});

describe('countLocalSyncItems', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('counts only active synced entities', async () => {
    await db.exercises.bulkPut([
      {
        id: 'custom-1',
        baseName: 'Custom 1',
        normalizedName: 'custom 1',
        muscles: ['Pecho'],
        equipment: ['Barra'],
        metricType: 'weight_reps',
        isCustom: true,
        source: 'custom',
        createdAt: '2026-03-05T10:00:00.000Z',
        updatedAt: '2026-03-05T10:00:00.000Z'
      },
      {
        id: 'custom-deleted',
        baseName: 'Custom eliminado',
        normalizedName: 'custom eliminado',
        muscles: ['Espalda'],
        equipment: ['Polea'],
        metricType: 'weight_reps',
        isCustom: true,
        source: 'custom',
        createdAt: '2026-03-05T10:00:00.000Z',
        updatedAt: '2026-03-05T10:00:00.000Z',
        deletedAt: '2026-03-05T11:00:00.000Z'
      }
    ]);

    await db.exerciseFavorites.put({
      exerciseId: 'custom-1',
      createdAt: '2026-03-05T10:00:00.000Z',
      updatedAt: '2026-03-05T10:00:00.000Z'
    });

    await db.routines.put({
      id: 'routine-1',
      name: 'Push',
      createdAt: '2026-03-05T10:00:00.000Z',
      updatedAt: '2026-03-05T10:00:00.000Z',
      order: 0
    });

    await db.workouts.put({
      id: 'workout-1',
      routineId: 'routine-1',
      routineName: 'Push',
      startedAt: '2026-03-05T10:00:00.000Z',
      endedAt: '2026-03-05T10:30:00.000Z',
      updatedAt: '2026-03-05T10:30:00.000Z'
    });

    await db.plannedWorkoutSeries.put({
      id: 'series-1',
      routineId: 'routine-1',
      kind: 'weekly',
      startDate: '2026-03-05',
      createdAt: '2026-03-05T10:00:00.000Z',
      updatedAt: '2026-03-05T10:00:00.000Z'
    });

    await db.plannedWorkoutOccurrences.put({
      id: 'occ-1',
      seriesId: 'series-1',
      occurrenceDate: '2026-03-06',
      status: 'pending',
      createdAt: '2026-03-05T10:00:00.000Z',
      updatedAt: '2026-03-05T10:00:00.000Z'
    });

    expect(await countLocalSyncItems()).toBe(6);
  });
});

