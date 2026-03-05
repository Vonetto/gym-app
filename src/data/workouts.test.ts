import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from './db';
import { listProgressionExerciseSessions, saveWorkout } from './workouts';
import type { ActiveWorkoutSession } from './activeSession';
import { closeTestDb, resetTestDb } from '../test/dbTestUtils';

function buildSession(overrides?: Partial<ActiveWorkoutSession>): ActiveWorkoutSession {
  return {
    id: `session-${crypto.randomUUID()}`,
    createdAt: '2026-03-05T10:00:00.000Z',
    exercises: [
      {
        exerciseId: 'exercise-1',
        name: 'Press de banca',
        metricType: 'weight_reps',
        sets: [
          {
            setType: 'normal',
            weight: 60,
            reps: 10,
            completed: true
          }
        ]
      }
    ],
    ...overrides
  };
}

describe('workouts persistence', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('does not save workouts when no set is completed', async () => {
    await saveWorkout(
      buildSession({
        exercises: [
          {
            exerciseId: 'exercise-1',
            name: 'Press de banca',
            metricType: 'weight_reps',
            sets: [{ weight: 60, reps: 10, completed: false }]
          }
        ]
      })
    );

    expect(await db.workouts.count()).toBe(0);
    expect(await db.workoutSets.count()).toBe(0);
  });

  it('stores only completed sets and falls back to Ejercicio Individual for ad-hoc sessions', async () => {
    const session = buildSession({
      routineId: undefined,
      routineName: undefined,
      exercises: [
        {
          exerciseId: 'exercise-1',
          name: 'Press de banca',
          metricType: 'weight_reps',
          sets: [
            { setType: 'normal', weight: 60, reps: 10, completed: true },
            { setType: 'normal', weight: 60, reps: 8, completed: false }
          ]
        }
      ]
    });

    await saveWorkout(session);

    const workouts = await db.workouts.toArray();
    const sets = await db.workoutSets.toArray();

    expect(workouts).toHaveLength(1);
    expect(workouts[0].routineName).toBe('Ejercicio Individual');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({
      weight: 60,
      reps: 10,
      completed: true
    });
  });

  it('filters progression sessions to set types that count for progression', async () => {
    const session = buildSession({
      exercises: [
        {
          exerciseId: 'exercise-1',
          name: 'Press de banca',
          metricType: 'weight_reps',
          sets: [
            { setType: 'warmup', weight: 20, reps: 12, completed: true },
            { setType: 'drop', weight: 50, reps: 8, completed: true },
            { setType: 'normal', weight: 60, reps: 10, completed: true },
            { setType: 'failure', weight: 62.5, reps: 6, completed: true }
          ]
        }
      ]
    });

    await saveWorkout(session);
    const sessions = await listProgressionExerciseSessions('exercise-1', 3);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sets).toHaveLength(2);
    expect(sessions[0].sets.map((set) => set.setType)).toEqual(['normal', 'failure']);
  });
});

