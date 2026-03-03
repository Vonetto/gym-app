import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getExerciseDisplayName,
  listExercises,
  listFavorites,
  listRecents
} from '../data/exercises';
import {
  addRoutineExercise,
  getRoutineDetail,
  removeRoutineExercise,
  reorderRoutineExercise,
  updateExerciseDefaults,
  updateRoutine
} from '../data/routines';
import { useSettings } from '../data/SettingsProvider';
import { ExerciseGoalMode, ExerciseMetric } from '../data/db';

function getMetricTypeLabel(metricType: ExerciseMetric) {
  if (metricType === 'weight_reps') return 'Peso + reps';
  if (metricType === 'reps') return 'Solo reps';
  if (metricType === 'time') return 'Tiempo';
  return 'Distancia';
}

export function RoutineDetail() {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [exerciseId, setExerciseId] = useState('');
  const [routineExercises, setRoutineExercises] = useState<
    Array<{ exerciseId: string; order: number }>
  >([]);
  const [defaults, setDefaults] = useState<
    Record<
      string,
      {
        metricTypeOverride?: ExerciseMetric;
        defaultSets?: number;
        defaultReps?: number;
        defaultWeight?: number;
        defaultDuration?: number;
        defaultDistance?: number;
        defaultRestSeconds?: number;
        goalMode?: ExerciseGoalMode;
      }
    >
  >({});
  const [exerciseOptions, setExerciseOptions] = useState<
    Array<{ id: string; label: string; metricType: ExerciseMetric }>
  >([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const loadDetail = async () => {
    if (!routineId) return;
    const detail = await getRoutineDetail(routineId);
    if (!detail) {
      navigate('/');
      return;
    }
    setName(detail.routine.name);
    setTags(detail.tags.join(', '));
    setRoutineExercises(detail.exercises);
    const defaultsMap: Record<
      string,
      {
        metricTypeOverride?: ExerciseMetric;
        defaultSets?: number;
        defaultReps?: number;
        defaultWeight?: number;
        defaultDuration?: number;
        defaultDistance?: number;
        defaultRestSeconds?: number;
        goalMode?: ExerciseGoalMode;
      }
    > = {};
    detail.defaults.forEach((item) => {
      defaultsMap[item.exerciseId] = {
        metricTypeOverride: item.metricTypeOverride,
        defaultSets: item.defaultSets,
        defaultReps: item.defaultReps,
        defaultWeight: item.defaultWeight,
        defaultDuration: item.defaultDuration,
        defaultDistance: item.defaultDistance,
        defaultRestSeconds: item.defaultRestSeconds,
        goalMode: item.goalMode ?? 'auto'
      };
    });
    setDefaults(defaultsMap);
  };

  const loadExercises = async () => {
    const [exercises, favorites, recents] = await Promise.all([
      listExercises(),
      listFavorites(),
      listRecents()
    ]);
    setExerciseOptions(
      exercises.map((exercise) => ({
        id: exercise.id,
        label: getExerciseDisplayName(exercise, settings.language),
        metricType: exercise.metricType
      }))
    );
    setFavoriteIds(favorites.map((item) => item.exerciseId));
    setRecentIds(recents.map((item) => item.exerciseId));
  };

  useEffect(() => {
    loadDetail();
    loadExercises();
  }, [routineId, settings.language]);

  const exerciseMap = useMemo(
    () =>
      new Map(
        exerciseOptions.map((exercise) => [
          exercise.id,
          { id: exercise.id, label: exercise.label, metricType: exercise.metricType }
        ])
      ),
    [exerciseOptions]
  );

  const handleSave = async () => {
    if (!routineId) return;
    await updateRoutine(
      routineId,
      {
        name: name.trim() || 'Sin nombre',
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      }
    );
    navigate('/');
  };

  const handleAddExercise = async () => {
    if (!routineId || !exerciseId) return;
    await addRoutineExercise(routineId, exerciseId);
    setExerciseId('');
    await loadDetail();
  };

  const handleRemoveExercise = async (exerciseIdToRemove: string) => {
    if (!routineId) return;
    await removeRoutineExercise(routineId, exerciseIdToRemove);
    await loadDetail();
  };

  const handleReorder = async (exerciseIdToMove: string, direction: 'up' | 'down') => {
    if (!routineId) return;
    await reorderRoutineExercise(routineId, exerciseIdToMove, direction);
    await loadDetail();
  };

  const handleDefaultChange = async (
    exerciseIdToUpdate: string,
    field:
      | 'metricTypeOverride'
      | 'defaultSets'
      | 'defaultReps'
      | 'defaultWeight'
      | 'defaultDuration'
      | 'defaultDistance'
      | 'defaultRestSeconds'
      | 'goalMode',
    value: string
  ) => {
    if (!routineId) return;
    const current = defaults[exerciseIdToUpdate] ?? {};
    const next =
      field === 'goalMode'
        ? { ...current, goalMode: (value || 'auto') as ExerciseGoalMode }
        : field === 'metricTypeOverride'
        ? { ...current, metricTypeOverride: value as ExerciseMetric }
        : { ...current, [field]: value ? Number(value) : undefined };
    setDefaults((prev) => ({ ...prev, [exerciseIdToUpdate]: next }));
    await updateExerciseDefaults({ routineId, exerciseId: exerciseIdToUpdate, ...next });
  };

  const handleMetricTypeChange = async (exerciseIdToUpdate: string, metricType: ExerciseMetric) => {
    if (!routineId) return;
    const current = defaults[exerciseIdToUpdate] ?? {};
    const next = {
      ...current,
      metricTypeOverride: metricType,
      defaultWeight:
        metricType === 'weight_reps' ? current.defaultWeight : metricType === 'reps' ? 0 : undefined,
      defaultReps:
        metricType === 'weight_reps' || metricType === 'reps' ? current.defaultReps : undefined,
      defaultDuration: metricType === 'time' ? current.defaultDuration : undefined,
      defaultDistance: metricType === 'distance' ? current.defaultDistance : undefined,
      goalMode: metricType === 'weight_reps' ? current.goalMode ?? 'auto' : undefined
    };
    setDefaults((prev) => ({ ...prev, [exerciseIdToUpdate]: next }));
    setOpenMenuId(null);
    await updateExerciseDefaults({ routineId, exerciseId: exerciseIdToUpdate, ...next });
  };

  return (
    <section className="stack wide">
      <div className="card">
        <div className="card-header">
          <h1>Editar rutina</h1>
          <Link className="ghost-button" to="/">
            Volver al inicio
          </Link>
        </div>
        <div className="field">
          <label className="label" htmlFor="routine-name-edit">
            Nombre
          </label>
          <input
            id="routine-name-edit"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <label className="label" htmlFor="routine-tags">
            Tags o días
          </label>
          <input
            id="routine-tags"
            type="text"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <button className="primary-button" type="button" onClick={handleSave}>
            Guardar y salir
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Ejercicios</h2>
        <div className="field inline">
          <select value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}>
            <option value="">Selecciona ejercicio</option>
            {favoriteIds.length ? (
              <optgroup label="Favoritos">
                {favoriteIds
                  .map((id) => exerciseMap.get(id))
                  .filter((item): item is { id: string; label: string; metricType: ExerciseMetric } =>
                    Boolean(item)
                  )
                  .map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.label}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            {recentIds.length ? (
              <optgroup label="Recientes">
                {recentIds
                  .filter((id) => !favoriteIds.includes(id))
                  .map((id) => exerciseMap.get(id))
                  .filter((item): item is { id: string; label: string; metricType: ExerciseMetric } =>
                    Boolean(item)
                  )
                  .map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.label}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            <optgroup label="Todos">
              {exerciseOptions.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.label}
                </option>
              ))}
            </optgroup>
          </select>
          <button className="ghost-button" type="button" onClick={handleAddExercise}>
            Añadir
          </button>
        </div>
        {routineExercises.length === 0 ? (
          <p className="muted">Agrega ejercicios para empezar a registrar la rutina.</p>
        ) : (
          <ul className="list">
            {routineExercises.map((exercise, index) => {
              const detail = exerciseMap.get(exercise.exerciseId);
              const defaultValues = defaults[exercise.exerciseId] ?? {};
              const metricType = defaultValues.metricTypeOverride ?? detail?.metricType ?? 'reps';
              const metricLabel = getMetricTypeLabel(metricType);
              return (
                <li key={exercise.exerciseId} className="list-row list-row-stack">
                  <div className="exercise-header">
                    <div>
                      <p className="list-title">{detail?.label ?? 'Ejercicio'}</p>
                      <p className="muted">
                        Orden #{index + 1} · Tipo {metricLabel}
                      </p>
                    </div>
                    <div className="exercise-menu-wrapper">
                      <button
                        className="menu-button"
                        type="button"
                        onClick={() =>
                          setOpenMenuId((prev) => (prev === exercise.exerciseId ? null : exercise.exerciseId))
                        }
                      >
                        ⋯
                      </button>
                      {openMenuId === exercise.exerciseId ? (
                        <div className="exercise-menu">
                          <p className="exercise-menu-meta">
                            Tipo actual: {metricLabel}
                          </p>
                          <button
                            className={metricType === 'weight_reps' ? 'selected' : ''}
                            type="button"
                            onClick={() => handleMetricTypeChange(exercise.exerciseId, 'weight_reps')}
                          >
                            Tipo: peso + reps
                          </button>
                          <button
                            className={metricType === 'reps' ? 'selected' : ''}
                            type="button"
                            onClick={() => handleMetricTypeChange(exercise.exerciseId, 'reps')}
                          >
                            Tipo: solo reps
                          </button>
                          <button
                            className={metricType === 'time' ? 'selected' : ''}
                            type="button"
                            onClick={() => handleMetricTypeChange(exercise.exerciseId, 'time')}
                          >
                            Tipo: tiempo
                          </button>
                          <button
                            className={metricType === 'distance' ? 'selected' : ''}
                            type="button"
                            onClick={() => handleMetricTypeChange(exercise.exerciseId, 'distance')}
                          >
                            Tipo: distancia
                          </button>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleReorder(exercise.exerciseId, 'up')}
                          >
                            Subir
                          </button>
                          <button
                            type="button"
                            disabled={index === routineExercises.length - 1}
                            onClick={() => handleReorder(exercise.exerciseId, 'down')}
                          >
                            Bajar
                          </button>
                          <button
                            className="danger"
                            type="button"
                            onClick={() => handleRemoveExercise(exercise.exerciseId)}
                          >
                            Quitar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="inline">
                    <label className="muted">
                      Sets
                      <input
                        type="number"
                        value={defaultValues.defaultSets ?? ''}
                        onChange={(event) =>
                          handleDefaultChange(exercise.exerciseId, 'defaultSets', event.target.value)
                        }
                      />
                    </label>
                    <label className="muted">
                      Reps
                      <input
                        type="number"
                        value={defaultValues.defaultReps ?? ''}
                        onChange={(event) =>
                          handleDefaultChange(exercise.exerciseId, 'defaultReps', event.target.value)
                        }
                      />
                    </label>
                    <label className="muted">
                      Descanso (seg)
                      <input
                        type="number"
                        min={0}
                        step={30}
                        value={defaultValues.defaultRestSeconds ?? ''}
                        onChange={(event) =>
                          handleDefaultChange(
                            exercise.exerciseId,
                            'defaultRestSeconds',
                            event.target.value
                          )
                        }
                      />
                    </label>
                    {metricType === 'weight_reps' ? (
                      <label className="muted">
                        Peso (kg)
                        <input
                          type="number"
                          step={0.5}
                          value={defaultValues.defaultWeight ?? ''}
                          onChange={(event) =>
                            handleDefaultChange(
                              exercise.exerciseId,
                              'defaultWeight',
                              event.target.value
                            )
                          }
                        />
                      </label>
                    ) : null}
                    {metricType === 'time' ? (
                      <label className="muted">
                        Duración (min)
                        <input
                          type="number"
                          step={0.5}
                          value={defaultValues.defaultDuration ?? ''}
                          onChange={(event) =>
                            handleDefaultChange(
                              exercise.exerciseId,
                              'defaultDuration',
                              event.target.value
                            )
                          }
                        />
                      </label>
                    ) : null}
                    {metricType === 'distance' ? (
                      <label className="muted">
                        Distancia (km)
                        <input
                          type="number"
                          step={0.1}
                          value={defaultValues.defaultDistance ?? ''}
                          onChange={(event) =>
                            handleDefaultChange(
                              exercise.exerciseId,
                              'defaultDistance',
                              event.target.value
                            )
                          }
                        />
                      </label>
                    ) : null}
                    {metricType === 'weight_reps' ? (
                      <label className="muted">
                        Objetivo
                        <select
                          value={defaultValues.goalMode ?? 'auto'}
                          onChange={(event) =>
                            handleDefaultChange(exercise.exerciseId, 'goalMode', event.target.value)
                          }
                        >
                          <option value="auto">Auto</option>
                          <option value="strength">Fuerza</option>
                          <option value="hypertrophy">Hipertrofia</option>
                          <option value="endurance">Resistencia</option>
                        </select>
                      </label>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
