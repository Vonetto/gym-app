import Dexie, { Table } from 'dexie';

export interface SettingsRecord {
  id: 'app';
  theme: 'dark' | 'light';
  language: 'es';
  units: 'kg';
}

export interface RoutineRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  order: number;
}

export type ExerciseMetric = 'weight_reps' | 'reps' | 'time' | 'distance';

export interface ExerciseRecord {
  id: string;
  baseName: string;
  normalizedName: string;
  muscles: string[];
  equipment: string[];
  metricType: ExerciseMetric;
  isCustom: boolean;
  source: 'wger' | 'custom';
  createdAt: string;
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
  defaultSets?: number;
  defaultReps?: number;
  defaultWeight?: number;
  defaultDuration?: number;
  defaultDistance?: number;
  defaultRestSeconds?: number;
}

export interface ExerciseFavoriteRecord {
  exerciseId: string;
  createdAt: string;
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
}

export interface WorkoutExerciseRecord {
  id: string;
  workoutId: string;
  exerciseId: string;
  name: string;
  order: number;
}

export interface WorkoutSetRecord {
  id: string;
  workoutExerciseId: string;
  order: number;
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  rpe?: number;
  completed: boolean;
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
  }
}

export const db = new AppDB();

export async function resetAll() {
  await db.delete();
  await db.open();
  localStorage.clear();
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}
