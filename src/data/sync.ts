import {
  type AdvancedSetType,
  db,
  type ExerciseGoalMode,
  type ExerciseMetric,
  type ExerciseRecord,
  type ExerciseTranslationRecord,
  type PlannedWorkoutOccurrenceRecord,
  type PlannedWorkoutSeriesRecord
} from './db';
import { resolveCanonicalExerciseId } from './catalogNormalization';
import { getSupabaseClient } from './supabase';
import { getSyncState, updateSyncState } from './syncState';
import { loadSettings, saveSettings } from './settings';

const PAGE_SIZE = 500;

type SyncMode = 'merge' | 'push_local' | 'replace_local';

type CloudTranslation = {
  language: string;
  name: string;
};

type CloudCustomExerciseRow = {
  user_id: string;
  id: string;
  base_name: string;
  normalized_name: string;
  muscles: string[];
  equipment: string[];
  metric_type: ExerciseMetric;
  translations: CloudTranslation[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CloudFavoriteRow = {
  user_id: string;
  exercise_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CloudRoutineExercise = {
  exerciseId: string;
  order: number;
  defaults?: {
    metricTypeOverride?: ExerciseMetric;
    defaultSetTypes?: AdvancedSetType[];
    defaultSets?: number;
    defaultReps?: number;
    defaultWeight?: number;
    defaultDuration?: number;
    defaultDistance?: number;
    defaultRestSeconds?: number;
    goalMode?: ExerciseGoalMode;
  };
};

type CloudRoutineRow = {
  user_id: string;
  id: string;
  name: string;
  order_index: number;
  tags: string[];
  exercises: CloudRoutineExercise[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CloudWorkoutSet = {
  order: number;
  setType?: AdvancedSetType;
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  rpe?: number;
  completed: boolean;
};

type CloudWorkoutExercise = {
  exerciseId: string;
  name: string;
  order: number;
  notes?: string;
  sets: CloudWorkoutSet[];
};

type CloudWorkoutRow = {
  user_id: string;
  id: string;
  routine_id: string | null;
  routine_name: string | null;
  tags: string[];
  started_at: string;
  ended_at: string;
  exercises: CloudWorkoutExercise[];
  updated_at: string;
  deleted_at: string | null;
};

type CloudScheduleSeriesRow = {
  user_id: string;
  id: string;
  routine_id: string;
  kind: 'once' | 'weekly' | 'weekdays';
  start_date: string;
  weekdays: number[];
  end_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CloudScheduleOccurrenceRow = {
  user_id: string;
  id: string;
  series_id: string;
  occurrence_date: string;
  status: 'pending' | 'completed' | 'omitted';
  workout_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CloudNotificationPreferencesRow = {
  user_id: string;
  notifications_enabled: boolean;
  planned_enabled: boolean;
  rest_enabled: boolean;
  background_session_enabled: boolean;
  planned_reminder_time: string;
  planned_reminder_offset_minutes: number;
  background_session_delay_minutes: number;
  timezone: string;
  updated_at: string;
};

interface RemoteSnapshot {
  customExercises: CloudCustomExerciseRow[];
  favorites: CloudFavoriteRow[];
  routines: CloudRoutineRow[];
  workouts: CloudWorkoutRow[];
  scheduleSeries: CloudScheduleSeriesRow[];
  scheduleOccurrences: CloudScheduleOccurrenceRow[];
  notificationPreferences: CloudNotificationPreferencesRow | null;
}

export type InitialSyncResolution =
  | { kind: 'ready' }
  | { kind: 'auto'; mode: 'push_local' | 'replace_local' }
  | { kind: 'prompt'; localCount: number; remoteHasData: boolean };

export interface SyncSummary {
  pushed: number;
  pulled: number;
  mode: SyncMode;
}

function latestTs(updatedAt?: string, deletedAt?: string | null) {
  return deletedAt && deletedAt > (updatedAt ?? '') ? deletedAt : updatedAt ?? '';
}

function shouldPush(localUpdatedAt?: string, localDeletedAt?: string, remoteUpdatedAt?: string, remoteDeletedAt?: string | null) {
  return latestTs(localUpdatedAt, localDeletedAt) > latestTs(remoteUpdatedAt, remoteDeletedAt);
}

function shouldApplyRemote(localUpdatedAt?: string, localDeletedAt?: string, remoteUpdatedAt?: string, remoteDeletedAt?: string | null) {
  return latestTs(remoteUpdatedAt, remoteDeletedAt) > latestTs(localUpdatedAt, localDeletedAt);
}

// Exposed for deterministic unit tests around conflict resolution.
export const syncConflictHelpers = {
  latestTs,
  shouldPush,
  shouldApplyRemote
};

async function fetchAllRows<T>(table: string, userId: string): Promise<T[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as T[];
    if (!page.length) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchRemoteSnapshot(userId: string): Promise<RemoteSnapshot> {
  const [customExercises, favorites, routines, workouts, scheduleSeries, scheduleOccurrences, notificationPrefsRows] =
    await Promise.all([
    fetchAllRows<CloudCustomExerciseRow>('user_custom_exercises', userId),
    fetchAllRows<CloudFavoriteRow>('user_favorites', userId),
    fetchAllRows<CloudRoutineRow>('user_routines', userId),
    fetchAllRows<CloudWorkoutRow>('user_workouts', userId),
    fetchAllRows<CloudScheduleSeriesRow>('user_schedule_series', userId),
    fetchAllRows<CloudScheduleOccurrenceRow>('user_schedule_occurrences', userId),
    fetchAllRows<CloudNotificationPreferencesRow>('user_notification_preferences', userId)
  ]);

  return {
    customExercises,
    favorites,
    routines,
    workouts,
    scheduleSeries,
    scheduleOccurrences,
    notificationPreferences: notificationPrefsRows[0] ?? null
  };
}

async function fetchHasRemoteData(userId: string) {
  const snapshot = await fetchRemoteSnapshot(userId);
  return (
    snapshot.customExercises.some((row) => !row.deleted_at) ||
    snapshot.favorites.some((row) => !row.deleted_at) ||
    snapshot.routines.some((row) => !row.deleted_at) ||
    snapshot.workouts.some((row) => !row.deleted_at) ||
    snapshot.scheduleSeries.some((row) => !row.deleted_at) ||
    snapshot.scheduleOccurrences.some((row) => !row.deleted_at)
  );
}

export async function countLocalSyncItems() {
  const [customExercises, favorites, routines, workouts, scheduleSeries, scheduleOccurrences] =
    await Promise.all([
    db.exercises.filter((exercise) => exercise.isCustom && !exercise.deletedAt).count(),
    db.exerciseFavorites.filter((favorite) => !favorite.deletedAt).count(),
    db.routines.filter((routine) => !routine.deletedAt).count(),
    db.workouts.filter((workout) => !workout.deletedAt).count(),
    db.plannedWorkoutSeries.filter((series) => !series.deletedAt).count(),
    db.plannedWorkoutOccurrences.filter((occurrence) => !occurrence.deletedAt).count()
  ]);

  return customExercises + favorites + routines + workouts + scheduleSeries + scheduleOccurrences;
}

export async function hasRemoteSyncData(userId: string) {
  return fetchHasRemoteData(userId);
}

async function serializeCustomExercises(userId: string, remoteMap: Map<string, CloudCustomExerciseRow>) {
  const exercises = await db.exercises
    .filter((exercise) => exercise.isCustom)
    .toArray();

  if (!exercises.length) return [];

  const translations = await db.exerciseTranslations
    .where('exerciseId')
    .anyOf(exercises.map((exercise) => exercise.id))
    .toArray();

  return exercises
    .filter((exercise) => shouldPush(exercise.updatedAt, exercise.deletedAt, remoteMap.get(exercise.id)?.updated_at, remoteMap.get(exercise.id)?.deleted_at))
    .map((exercise) => ({
      user_id: userId,
      id: exercise.id,
      base_name: exercise.baseName,
      normalized_name: exercise.normalizedName,
      muscles: exercise.muscles,
      equipment: exercise.equipment,
      metric_type: exercise.metricType,
      translations: translations
        .filter((item) => item.exerciseId === exercise.id)
        .map((item) => ({ language: item.language, name: item.name })),
      created_at: exercise.createdAt,
      updated_at: exercise.updatedAt,
      deleted_at: exercise.deletedAt ?? null
    }));
}

async function serializeFavorites(userId: string, remoteMap: Map<string, CloudFavoriteRow>) {
  const favorites = await db.exerciseFavorites.toArray();
  const mergedByCanonicalId = new Map<string, typeof favorites[number]>();
  favorites.forEach((favorite) => {
    const canonicalId = resolveCanonicalExerciseId(favorite.exerciseId);
    const current = mergedByCanonicalId.get(canonicalId);
    if (
      !current ||
      latestTs(favorite.updatedAt, favorite.deletedAt) >
        latestTs(current.updatedAt, current.deletedAt)
    ) {
      mergedByCanonicalId.set(canonicalId, {
        ...favorite,
        exerciseId: canonicalId
      });
    }
  });

  return [...mergedByCanonicalId.values()]
    .filter((favorite) =>
      shouldPush(
        favorite.updatedAt,
        favorite.deletedAt,
        remoteMap.get(favorite.exerciseId)?.updated_at,
        remoteMap.get(favorite.exerciseId)?.deleted_at
      )
    )
    .map((favorite) => ({
      user_id: userId,
      exercise_id: favorite.exerciseId,
      created_at: favorite.createdAt,
      updated_at: favorite.updatedAt,
      deleted_at: favorite.deletedAt ?? null
    }));
}

async function serializeRoutines(userId: string, remoteMap: Map<string, CloudRoutineRow>) {
  const routines = await db.routines.toArray();
  if (!routines.length) return [];

  const routineIds = routines.map((routine) => routine.id);
  const [tags, exercises, defaults] = await Promise.all([
    db.routineTags.where('routineId').anyOf(routineIds).toArray(),
    db.routineExercises.where('routineId').anyOf(routineIds).toArray(),
    db.exerciseDefaults.where('routineId').anyOf(routineIds).toArray()
  ]);

  return routines
    .filter((routine) =>
      shouldPush(
        routine.updatedAt,
        routine.deletedAt,
        remoteMap.get(routine.id)?.updated_at,
        remoteMap.get(routine.id)?.deleted_at
      )
    )
    .map((routine) => ({
      user_id: userId,
      id: routine.id,
      name: routine.name,
      order_index: routine.order,
      tags: tags.filter((tag) => tag.routineId === routine.id).map((tag) => tag.tag),
      exercises: (() => {
        const normalizedExercises = exercises
          .filter((exercise) => exercise.routineId === routine.id)
          .sort((a, b) => a.order - b.order)
          .map((exercise) => ({
            ...exercise,
            exerciseId: resolveCanonicalExerciseId(exercise.exerciseId)
          }));
        const seenExerciseIds = new Set<string>();
        return normalizedExercises
          .filter((exercise) => {
            if (seenExerciseIds.has(exercise.exerciseId)) return false;
            seenExerciseIds.add(exercise.exerciseId);
            return true;
          })
          .map((exercise, index) => ({
            exerciseId: exercise.exerciseId,
            order: index,
            defaults: defaults
              .filter(
                (item) =>
                  item.routineId === routine.id &&
                  resolveCanonicalExerciseId(item.exerciseId) === exercise.exerciseId
              )
              .map((item) => ({
                metricTypeOverride: item.metricTypeOverride,
                defaultSetTypes: item.defaultSetTypes,
                defaultSets: item.defaultSets,
                defaultReps: item.defaultReps,
                defaultWeight: item.defaultWeight,
                defaultDuration: item.defaultDuration,
                defaultDistance: item.defaultDistance,
                defaultRestSeconds: item.defaultRestSeconds,
                goalMode: item.goalMode
              }))[0]
          }));
      })(),
      created_at: routine.createdAt,
      updated_at: routine.updatedAt,
      deleted_at: routine.deletedAt ?? null
    }));
}

async function serializeWorkouts(userId: string, remoteMap: Map<string, CloudWorkoutRow>) {
  const workouts = await db.workouts.toArray();
  if (!workouts.length) return [];

  const workoutIds = workouts.map((workout) => workout.id);
  const workoutExercises = await db.workoutExercises.where('workoutId').anyOf(workoutIds).toArray();
  const setIds = workoutExercises.map((exercise) => exercise.id);
  const sets = setIds.length
    ? await db.workoutSets.where('workoutExerciseId').anyOf(setIds).toArray()
    : [];

  return workouts
    .filter((workout) =>
      shouldPush(
        workout.updatedAt,
        workout.deletedAt,
        remoteMap.get(workout.id)?.updated_at,
        remoteMap.get(workout.id)?.deleted_at
      )
    )
    .map((workout) => ({
      user_id: userId,
      id: workout.id,
      routine_id: workout.routineId ?? null,
      routine_name: workout.routineName ?? null,
      tags: workout.tags ?? [],
      started_at: workout.startedAt,
      ended_at: workout.endedAt,
      exercises: workoutExercises
        .filter((exercise) => exercise.workoutId === workout.id)
        .sort((a, b) => a.order - b.order)
        .map((exercise) => ({
          exerciseId: resolveCanonicalExerciseId(exercise.exerciseId),
          name: exercise.name,
          order: exercise.order,
          notes: exercise.notes,
          sets: sets
            .filter((set) => set.workoutExerciseId === exercise.id)
            .sort((a, b) => a.order - b.order)
            .map((set) => ({
              order: set.order,
              setType: set.setType,
              weight: set.weight,
              reps: set.reps,
              duration: set.duration,
              distance: set.distance,
              rpe: set.rpe,
              completed: set.completed
            }))
        })),
      updated_at: workout.updatedAt,
      deleted_at: workout.deletedAt ?? null
    }));
}

async function serializeScheduleSeries(userId: string, remoteMap: Map<string, CloudScheduleSeriesRow>) {
  const rows = await db.plannedWorkoutSeries.toArray();
  return rows
    .filter((row) =>
      shouldPush(
        row.updatedAt,
        row.deletedAt,
        remoteMap.get(row.id)?.updated_at,
        remoteMap.get(row.id)?.deleted_at
      )
    )
    .map((row) => ({
      user_id: userId,
      id: row.id,
      routine_id: row.routineId,
      kind: row.kind,
      start_date: row.startDate,
      weekdays: row.weekdays ?? [],
      end_date: row.endDate ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt ?? null
    }));
}

async function serializeScheduleOccurrences(
  userId: string,
  remoteMap: Map<string, CloudScheduleOccurrenceRow>
) {
  const rows = await db.plannedWorkoutOccurrences.toArray();
  return rows
    .filter((row) =>
      shouldPush(
        row.updatedAt,
        row.deletedAt,
        remoteMap.get(row.id)?.updated_at,
        remoteMap.get(row.id)?.deleted_at
      )
    )
    .map((row) => ({
      user_id: userId,
      id: row.id,
      series_id: row.seriesId,
      occurrence_date: row.occurrenceDate,
      status: row.status,
      workout_id: row.workoutId ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt ?? null
    }));
}

async function serializeNotificationPreferences(
  userId: string,
  remoteRow: CloudNotificationPreferencesRow | null
) {
  const settings = await loadSettings();
  const localUpdatedAt = settings.notificationSettingsUpdatedAt;
  if (!shouldPush(localUpdatedAt, undefined, remoteRow?.updated_at, null)) {
    return [];
  }

  return [
    {
      user_id: userId,
      notifications_enabled: Boolean(settings.notificationsEnabled),
      planned_enabled: Boolean(settings.plannedWorkoutNotificationsEnabled),
      rest_enabled: Boolean(settings.restFinishedNotificationsEnabled),
      background_session_enabled: Boolean(settings.backgroundSessionNotificationsEnabled),
      planned_reminder_time: settings.plannedReminderTime ?? '19:00',
      planned_reminder_offset_minutes: settings.plannedReminderOffsetMinutes ?? 0,
      background_session_delay_minutes: settings.backgroundSessionReminderDelayMinutes ?? 10,
      timezone: settings.notificationTimezone ?? 'UTC',
      updated_at: localUpdatedAt ?? new Date().toISOString()
    }
  ];
}

async function upsertRows(table: string, rows: object[], conflict: string) {
  if (!rows.length) return 0;
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
  if (error) throw error;
  return rows.length;
}

async function clearSyncedLocalData() {
  await db.transaction(
    'rw',
    [
      db.exercises,
      db.exerciseTranslations,
      db.exerciseFavorites,
      db.exerciseRecents,
      db.routines,
      db.routineTags,
      db.routineExercises,
      db.exerciseDefaults,
      db.routineVersions,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.plannedWorkoutSeries,
      db.plannedWorkoutOccurrences
    ],
    async () => {
      const customExercises = await db.exercises.filter((exercise) => exercise.isCustom).toArray();
      if (customExercises.length) {
        await db.exercises.bulkDelete(customExercises.map((exercise) => exercise.id));
        const customIds = customExercises.map((exercise) => exercise.id);
        const translations = await db.exerciseTranslations.where('exerciseId').anyOf(customIds).toArray();
        if (translations.length) {
          await db.exerciseTranslations.bulkDelete(translations.map((translation) => translation.id));
        }
      }

      await db.exerciseFavorites.clear();
      await db.exerciseRecents.clear();
      await db.routineTags.clear();
      await db.routineExercises.clear();
      await db.exerciseDefaults.clear();
      await db.routineVersions.clear();
      await db.routines.clear();
      await db.workoutSets.clear();
      await db.workoutExercises.clear();
      await db.workouts.clear();
      await db.plannedWorkoutOccurrences.clear();
      await db.plannedWorkoutSeries.clear();
    }
  );
}

async function applyRemoteCustomExercises(rows: CloudCustomExerciseRow[]) {
  for (const row of rows) {
    const local = await db.exercises.get(row.id);
    if (local && !shouldApplyRemote(local.updatedAt, local.deletedAt, row.updated_at, row.deleted_at)) {
      continue;
    }

    if (row.deleted_at) {
      const now = row.updated_at;
      await db.transaction(
        'rw',
        [
          db.exercises,
          db.exerciseFavorites,
          db.exerciseRecents,
          db.routineExercises,
          db.exerciseDefaults,
          db.routines
        ],
        async () => {
          if (local) {
            await db.exercises.put({
              ...local,
              updatedAt: now,
              deletedAt: row.deleted_at ?? now
            });
          }

          const favorite = await db.exerciseFavorites.get(row.id);
          if (favorite) {
            await db.exerciseFavorites.put({
              ...favorite,
              updatedAt: now,
              deletedAt: row.deleted_at ?? now
            });
          }

          await db.exerciseRecents.delete(row.id);
          const routineExercises = await db.routineExercises.where('exerciseId').equals(row.id).toArray();
          if (routineExercises.length) {
            const affectedRoutineIds = Array.from(
              new Set(routineExercises.map((exercise) => exercise.routineId))
            );
            await db.routineExercises.bulkDelete(routineExercises.map((exercise) => exercise.id));
            const defaults = await db.exerciseDefaults.where('exerciseId').equals(row.id).toArray();
            if (defaults.length) {
              await db.exerciseDefaults.bulkDelete(defaults.map((item) => item.id));
            }
            await Promise.all(
              affectedRoutineIds.map((routineId) =>
                db.routines.update(routineId, {
                  updatedAt: now
                })
              )
            );
          }
        }
      );
      continue;
    }

    const nextExercise: ExerciseRecord = {
      id: row.id,
      baseName: row.base_name,
      normalizedName: row.normalized_name,
      muscles: row.muscles ?? [],
      equipment: row.equipment ?? [],
      metricType: row.metric_type,
      isCustom: true,
      source: 'custom',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: undefined
    };

    const translations: ExerciseTranslationRecord[] = (row.translations ?? []).map((translation) => ({
      id: `${row.id}-${translation.language}`,
      exerciseId: row.id,
      language: translation.language,
      name: translation.name
    }));

    await db.transaction('rw', db.exercises, db.exerciseTranslations, async () => {
      await db.exercises.put(nextExercise);
      const existingTranslations = await db.exerciseTranslations
        .where('exerciseId')
        .equals(row.id)
        .toArray();
      if (existingTranslations.length) {
        await db.exerciseTranslations.bulkDelete(existingTranslations.map((item) => item.id));
      }
      if (translations.length) {
        await db.exerciseTranslations.bulkAdd(translations);
      }
    });
  }
}

async function applyRemoteFavorites(rows: CloudFavoriteRow[]) {
  for (const row of rows) {
    const canonicalExerciseId = resolveCanonicalExerciseId(row.exercise_id);
    const local = await db.exerciseFavorites.get(canonicalExerciseId);
    if (
      local &&
      !shouldApplyRemote(local.updatedAt, local.deletedAt, row.updated_at, row.deleted_at)
    ) {
      continue;
    }

    await db.exerciseFavorites.put({
      exerciseId: canonicalExerciseId,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined
    });
  }
}

async function applyRemoteRoutines(rows: CloudRoutineRow[]) {
  for (const row of rows) {
    const local = await db.routines.get(row.id);
    if (local && !shouldApplyRemote(local.updatedAt, local.deletedAt, row.updated_at, row.deleted_at)) {
      continue;
    }

    await db.transaction(
      'rw',
      [db.routines, db.routineTags, db.routineExercises, db.exerciseDefaults],
      async () => {
        await db.routines.put({
          id: row.id,
          name: row.name,
          order: row.order_index,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at ?? undefined
        });

        await db.routineTags.where('routineId').equals(row.id).delete();
        await db.routineExercises.where('routineId').equals(row.id).delete();
        await db.exerciseDefaults.where('routineId').equals(row.id).delete();

        if (row.deleted_at) {
          return;
        }

        if (row.tags?.length) {
          await db.routineTags.bulkAdd(
            row.tags.map((tag) => ({
              id: `${row.id}-${tag}`,
              routineId: row.id,
              tag
            }))
          );
        }

        if (row.exercises?.length) {
          const normalizedExercises = [...row.exercises]
            .map((exercise) => ({
              ...exercise,
              exerciseId: resolveCanonicalExerciseId(exercise.exerciseId)
            }))
            .sort((a, b) => a.order - b.order);
          const seenExerciseIds = new Set<string>();
          const dedupedExercises = normalizedExercises.filter((exercise) => {
            if (seenExerciseIds.has(exercise.exerciseId)) return false;
            seenExerciseIds.add(exercise.exerciseId);
            return true;
          });
          const routineExercises = dedupedExercises.map((exercise, index) => ({
            id: `routine-exercise-${crypto.randomUUID()}`,
            routineId: row.id,
            exerciseId: exercise.exerciseId,
            order: index
          }));
          await db.routineExercises.bulkAdd(routineExercises);

          const defaults = dedupedExercises
            .filter((exercise) => exercise.defaults)
            .map((exercise) => ({
              id: `default-${crypto.randomUUID()}`,
              routineId: row.id,
              exerciseId: exercise.exerciseId,
              ...exercise.defaults
            }));

          if (defaults.length) {
            await db.exerciseDefaults.bulkAdd(defaults);
          }
        }
      }
    );
  }
}

async function applyRemoteWorkouts(rows: CloudWorkoutRow[]) {
  for (const row of rows) {
    const local = await db.workouts.get(row.id);
    if (local && !shouldApplyRemote(local.updatedAt, local.deletedAt, row.updated_at, row.deleted_at)) {
      continue;
    }

    await db.transaction(
      'rw',
      [db.workouts, db.workoutExercises, db.workoutSets],
      async () => {
        await db.workouts.put({
          id: row.id,
          routineId: row.routine_id ?? undefined,
          routineName: row.routine_name ?? undefined,
          tags: row.tags ?? [],
          startedAt: row.started_at,
          endedAt: row.ended_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at ?? undefined
        });

        const existingExercises = await db.workoutExercises.where('workoutId').equals(row.id).toArray();
        if (existingExercises.length) {
          const existingExerciseIds = existingExercises.map((exercise) => exercise.id);
          const existingSets = await db.workoutSets
            .where('workoutExerciseId')
            .anyOf(existingExerciseIds)
            .toArray();
          if (existingSets.length) {
            await db.workoutSets.bulkDelete(existingSets.map((set) => set.id));
          }
          await db.workoutExercises.bulkDelete(existingExerciseIds);
        }

        if (row.deleted_at) {
          return;
        }

        const workoutExercises = row.exercises ?? [];
        for (const exercise of workoutExercises) {
          const workoutExerciseId = `workout-exercise-${crypto.randomUUID()}`;
          await db.workoutExercises.add({
            id: workoutExerciseId,
            workoutId: row.id,
            exerciseId: resolveCanonicalExerciseId(exercise.exerciseId),
            name: exercise.name,
            order: exercise.order,
            notes: exercise.notes
          });

          if (exercise.sets?.length) {
            await db.workoutSets.bulkAdd(
              exercise.sets.map((set) => ({
                id: `workout-set-${crypto.randomUUID()}`,
                workoutExerciseId,
                order: set.order,
                setType: set.setType,
                weight: set.weight,
                reps: set.reps,
                duration: set.duration,
                distance: set.distance,
                rpe: set.rpe,
                completed: set.completed
              }))
            );
          }
        }
      }
    );
  }
}

async function applyRemoteScheduleSeries(rows: CloudScheduleSeriesRow[]) {
  for (const row of rows) {
    const local = await db.plannedWorkoutSeries.get(row.id);
    if (local && !shouldApplyRemote(local.updatedAt, local.deletedAt, row.updated_at, row.deleted_at)) {
      continue;
    }

    const record: PlannedWorkoutSeriesRecord = {
      id: row.id,
      routineId: row.routine_id,
      kind: row.kind,
      startDate: row.start_date,
      weekdays: row.weekdays ?? undefined,
      endDate: row.end_date ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined
    };

    await db.plannedWorkoutSeries.put(record);
  }
}

async function applyRemoteScheduleOccurrences(rows: CloudScheduleOccurrenceRow[]) {
  for (const row of rows) {
    const local = await db.plannedWorkoutOccurrences.get(row.id);
    if (local && !shouldApplyRemote(local.updatedAt, local.deletedAt, row.updated_at, row.deleted_at)) {
      continue;
    }

    const record: PlannedWorkoutOccurrenceRecord = {
      id: row.id,
      seriesId: row.series_id,
      occurrenceDate: row.occurrence_date,
      status: row.status,
      workoutId: row.workout_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined
    };

    await db.plannedWorkoutOccurrences.put(record);
  }
}

async function applyRemoteNotificationPreferences(row: CloudNotificationPreferencesRow | null) {
  if (!row) return;

  const settings = await loadSettings();
  if (!shouldApplyRemote(settings.notificationSettingsUpdatedAt, undefined, row.updated_at, null)) {
    return;
  }

  await saveSettings({
    ...settings,
    notificationsEnabled: row.notifications_enabled,
    plannedWorkoutNotificationsEnabled: row.planned_enabled,
    restFinishedNotificationsEnabled: row.rest_enabled,
    backgroundSessionNotificationsEnabled: row.background_session_enabled,
    plannedReminderTime: row.planned_reminder_time,
    plannedReminderOffsetMinutes: row.planned_reminder_offset_minutes,
    backgroundSessionReminderDelayMinutes: row.background_session_delay_minutes,
    notificationTimezone: row.timezone,
    notificationSettingsUpdatedAt: row.updated_at
  });
}

async function applyRemoteSnapshot(snapshot: RemoteSnapshot) {
  await applyRemoteCustomExercises(snapshot.customExercises);
  await applyRemoteFavorites(snapshot.favorites);
  await applyRemoteRoutines(snapshot.routines);
  await applyRemoteWorkouts(snapshot.workouts);
  await applyRemoteScheduleSeries(snapshot.scheduleSeries);
  await applyRemoteScheduleOccurrences(snapshot.scheduleOccurrences);
  await applyRemoteNotificationPreferences(snapshot.notificationPreferences);
}

export async function syncUserData(userId: string, mode: SyncMode = 'merge'): Promise<SyncSummary> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  if (!navigator.onLine) {
    await updateSyncState('sync-status', {
      status: 'offline-pending',
      lastAttemptAt: new Date().toISOString()
    });
    throw new Error('offline');
  }

  await updateSyncState('sync-status', {
    status: 'syncing',
    lastAttemptAt: new Date().toISOString(),
    lastError: undefined
  });

  try {
    const remoteBefore = await fetchRemoteSnapshot(userId);

    if (mode === 'replace_local') {
      await clearSyncedLocalData();
    } else {
      const [
        pushedCustomExercises,
        pushedFavorites,
        pushedRoutines,
        pushedWorkouts,
        pushedScheduleSeries,
        pushedScheduleOccurrences,
        pushedNotificationPreferences
      ] =
        await Promise.all([
          upsertRows(
            'user_custom_exercises',
            await serializeCustomExercises(
              userId,
              new Map(remoteBefore.customExercises.map((row) => [row.id, row]))
            ),
            'user_id,id'
          ),
          upsertRows(
            'user_favorites',
            await serializeFavorites(
              userId,
              new Map(remoteBefore.favorites.map((row) => [row.exercise_id, row]))
            ),
            'user_id,exercise_id'
          ),
          upsertRows(
            'user_routines',
            await serializeRoutines(
              userId,
              new Map(remoteBefore.routines.map((row) => [row.id, row]))
            ),
            'user_id,id'
          ),
          upsertRows(
            'user_workouts',
            await serializeWorkouts(
              userId,
              new Map(remoteBefore.workouts.map((row) => [row.id, row]))
            ),
            'user_id,id'
          ),
          upsertRows(
            'user_schedule_series',
            await serializeScheduleSeries(
              userId,
              new Map(remoteBefore.scheduleSeries.map((row) => [row.id, row]))
            ),
            'user_id,id'
          ),
          upsertRows(
            'user_schedule_occurrences',
            await serializeScheduleOccurrences(
              userId,
              new Map(remoteBefore.scheduleOccurrences.map((row) => [row.id, row]))
            ),
            'user_id,id'
          ),
          upsertRows(
            'user_notification_preferences',
            await serializeNotificationPreferences(userId, remoteBefore.notificationPreferences),
            'user_id'
          )
        ]);

      const remoteAfterPush = await fetchRemoteSnapshot(userId);
      await applyRemoteSnapshot(remoteAfterPush);

      const summary: SyncSummary = {
        pushed:
          pushedCustomExercises +
          pushedFavorites +
          pushedRoutines +
          pushedWorkouts +
          pushedScheduleSeries +
          pushedScheduleOccurrences +
          pushedNotificationPreferences,
        pulled:
          remoteAfterPush.customExercises.length +
          remoteAfterPush.favorites.length +
          remoteAfterPush.routines.length +
          remoteAfterPush.workouts.length +
          remoteAfterPush.scheduleSeries.length +
          remoteAfterPush.scheduleOccurrences.length +
          (remoteAfterPush.notificationPreferences ? 1 : 0),
        mode
      };

      const syncedAt = new Date().toISOString();
      await updateSyncState('sync-status', {
        status: 'success',
        lastSyncedAt: syncedAt,
        lastAttemptAt: syncedAt,
        lastError: undefined
      });
      await updateSyncState('sync-cursor:full', {
        cursor: syncedAt,
        lastSyncedAt: syncedAt,
        status: 'success'
      });
      return summary;
    }

    const remoteAfterReplace = await fetchRemoteSnapshot(userId);
    await applyRemoteSnapshot(remoteAfterReplace);

    const syncedAt = new Date().toISOString();
    await updateSyncState('sync-status', {
      status: 'success',
      lastSyncedAt: syncedAt,
      lastAttemptAt: syncedAt,
      lastError: undefined
    });
    await updateSyncState('sync-cursor:full', {
      cursor: syncedAt,
      lastSyncedAt: syncedAt,
      status: 'success'
    });

    return {
      pushed: 0,
      pulled:
        remoteAfterReplace.customExercises.length +
        remoteAfterReplace.favorites.length +
        remoteAfterReplace.routines.length +
        remoteAfterReplace.workouts.length +
        remoteAfterReplace.scheduleSeries.length +
        remoteAfterReplace.scheduleOccurrences.length +
        (remoteAfterReplace.notificationPreferences ? 1 : 0),
      mode
    };
  } catch (error) {
    await updateSyncState('sync-status', {
      status: navigator.onLine ? 'error' : 'offline-pending',
      lastError: error instanceof Error ? error.message : 'sync-error'
    });
    throw error;
  }
}

export async function resolveInitialSyncMode(userId: string): Promise<InitialSyncResolution> {
  const migration = await getSyncState(`migration:${userId}`);
  if (migration.value === 'resolved') {
    return { kind: 'ready' as const };
  }

  const [localCount, remoteHasData] = await Promise.all([countLocalSyncItems(), hasRemoteSyncData(userId)]);

  if (localCount === 0 && !remoteHasData) {
    await updateSyncState(`migration:${userId}`, {
      value: 'resolved',
      status: 'success'
    });
    return { kind: 'ready' as const };
  }

  if (localCount === 0 && remoteHasData) {
    return { kind: 'auto', mode: 'replace_local' as const };
  }

  return {
    kind: 'prompt' as const,
    localCount,
    remoteHasData
  };
}

export async function markMigrationResolved(userId: string) {
  await updateSyncState(`migration:${userId}`, {
    value: 'resolved',
    status: 'success',
    lastSyncedAt: new Date().toISOString()
  });
}
