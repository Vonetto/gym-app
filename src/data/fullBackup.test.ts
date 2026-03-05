import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db, type ExerciseRecord, type RoutineRecord } from './db';
import {
  FULL_BACKUP_SCHEMA_VERSION,
  FULL_BACKUP_TYPE,
  FullBackupError,
  importFullBackup,
  listBackupSnapshots,
  parseAndValidateFullBackupText,
  type FullBackupPayload
} from './fullBackup';
import { defaultSettings } from './settings';
import { closeTestDb, resetTestDb } from '../test/dbTestUtils';

function buildMinimalPayload(): FullBackupPayload {
  return {
    backupType: FULL_BACKUP_TYPE,
    schemaVersion: FULL_BACKUP_SCHEMA_VERSION,
    exportedAt: '2026-03-05T12:00:00.000Z',
    data: {
      settings: {
        ...defaultSettings,
        id: 'app',
        settingsUpdatedAt: '2026-03-05T12:00:00.000Z'
      },
      customExercises: [],
      exerciseFavorites: [],
      exerciseRecents: [],
      routines: [],
      workouts: [],
      plannedWorkoutSeries: [],
      plannedWorkoutOccurrences: []
    }
  };
}

describe('fullBackup', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('rejects invalid JSON payloads', async () => {
    await expect(parseAndValidateFullBackupText('{invalid}')).rejects.toMatchObject({
      code: 'invalid-json'
    });
  });

  it('rejects routine-level payloads in full backup parser', async () => {
    await expect(parseAndValidateFullBackupText(JSON.stringify({ version: 4 }))).rejects.toMatchObject({
      code: 'wrong-backup-type'
    });
  });

  it('rejects corrupt references before import', async () => {
    const payload = buildMinimalPayload();
    payload.data.exerciseFavorites.push({
      exerciseId: 'missing-exercise',
      createdAt: '2026-03-05T12:00:00.000Z',
      updatedAt: '2026-03-05T12:00:00.000Z'
    });

    await expect(parseAndValidateFullBackupText(JSON.stringify(payload))).rejects.toMatchObject({
      code: 'corrupt-backup'
    });
  });

  it('merges routines with deterministic name suffix on collision', async () => {
    const localRoutine: RoutineRecord = {
      id: 'routine-local',
      name: 'Pull',
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      order: 0
    };
    await db.routines.put(localRoutine);

    const payload = buildMinimalPayload();
    payload.data.routines.push({
      routine: {
        id: 'routine-remote',
        name: 'Pull',
        createdAt: '2026-03-05T10:00:00.000Z',
        updatedAt: '2026-03-05T10:00:00.000Z',
        order: 1
      },
      tags: [],
      exercises: []
    });

    const result = await importFullBackup(payload, 'merge');
    const names = (await db.routines.toArray())
      .filter((routine) => !routine.deletedAt)
      .map((routine) => routine.name)
      .sort();

    expect(names).toEqual(['Pull', 'Pull (2)']);
    expect(result.sections.routines.imported + result.sections.routines.merged).toBe(1);
    expect(result.sections.routines.renamed).toBe(1);
    expect(result.autoBackup.id).toBeTruthy();
    expect((await listBackupSnapshots()).length).toBe(1);
  });

  it('replace mode preserves base exercises and restores custom payload data', async () => {
    const baseExercise: ExerciseRecord = {
      id: 'wger-1',
      baseName: 'Sentadilla (Barra)',
      normalizedName: 'sentadilla barra',
      muscles: ['Cuádriceps'],
      equipment: ['Barra'],
      metricType: 'weight_reps',
      isCustom: false,
      source: 'wger',
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z'
    };
    const oldCustom: ExerciseRecord = {
      id: 'custom-old',
      baseName: 'Custom viejo',
      normalizedName: 'custom viejo',
      muscles: ['Pecho'],
      equipment: ['Mancuerna'],
      metricType: 'weight_reps',
      isCustom: true,
      source: 'custom',
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z'
    };
    await db.exercises.bulkPut([baseExercise, oldCustom]);
    await db.exerciseTranslations.put({
      id: 'custom-old-es',
      exerciseId: 'custom-old',
      language: 'es',
      name: 'Custom viejo'
    });

    const payload = buildMinimalPayload();
    payload.data.customExercises.push({
      exercise: {
        id: 'custom-new',
        baseName: 'Custom nuevo',
        normalizedName: 'custom nuevo',
        muscles: ['Espalda'],
        equipment: ['Polea'],
        metricType: 'weight_reps',
        isCustom: true,
        source: 'custom',
        createdAt: '2026-03-05T10:00:00.000Z',
        updatedAt: '2026-03-05T10:00:00.000Z'
      },
      translations: [
        {
          language: 'es',
          name: 'Custom nuevo'
        }
      ]
    });

    const result = await importFullBackup(payload, 'replace');
    const allExercises = await db.exercises.toArray();
    const activeIds = allExercises.filter((exercise) => !exercise.deletedAt).map((exercise) => exercise.id);

    expect(activeIds).toContain('wger-1');
    expect(activeIds).toContain('custom-new');
    expect(activeIds).not.toContain('custom-old');
    expect(result.sections.customExercises.imported).toBe(1);
    expect((await listBackupSnapshots()).length).toBe(1);
  });

  it('maps wrong backup type to explicit FullBackupError', async () => {
    try {
      await parseAndValidateFullBackupText(JSON.stringify({ backupType: 'wrong', schemaVersion: 1, data: {} }));
      expect.fail('Expected parser to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(FullBackupError);
      expect((error as FullBackupError).code).toBe('invalid-backup');
    }
  });
});

