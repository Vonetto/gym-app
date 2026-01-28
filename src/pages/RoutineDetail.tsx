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
import { ExerciseMetric } from '../data/db';

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
        defaultSets?: number;
        defaultReps?: number;
        defaultWeight?: number;
        defaultDuration?: number;
        defaultDistance?: number;
        defaultRestSeconds?: number;
      }
    >
  >({});
  const [exerciseOptions, setExerciseOptions] = useState<
    Array<{ id: string; label: string; metricType: ExerciseMetric }>
  >([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const loadDetail = async () => {
    if (!routineId) return;
    const detail = await getRoutineDetail(routineId);
    if (!detail) {
      navigate('/routines');
      return;
    }
    setName(detail.routine.name);
    setTags(detail.tags.join(', '));
    setRoutineExercises(detail.exercises);
    const defaultsMap: Record<
      string,
      {
        defaultSets?: number;
        defaultReps?: number;
        defaultWeight?: number;
        defaultDuration?: number;
        defaultDistance?: number;
        defaultRestSeconds?: number;
      }
    > = {};
    detail.defaults.forEach((item) => {
      defaultsMap[item.exerciseId] = {
        defaultSets: item.defaultSets,
        defaultReps: item.defaultReps,
        defaultWeight: item.defaultWeight,
        defaultDuration: item.defaultDuration,
        defaultDistance: item.defaultDistance,
        defaultRestSeconds: item.defaultRestSeconds
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
    await loadDetail();
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
      | 'defaultSets'
      | 'defaultReps'
      | 'defaultWeight'
      | 'defaultDuration'
      | 'defaultDistance'
      | 'defaultRestSeconds',
    value: string
  ) => {
    if (!routineId) return;
    const numeric = value ? Number(value) : undefined;
    const current = defaults[exerciseIdToUpdate] ?? {};
    const next = { ...current, [field]: numeric };
    setDefaults((prev) => ({ ...prev, [exerciseIdToUpdate]: next }));
    await updateExerciseDefaults({ routineId, exerciseId: exerciseIdToUpdate, ...next });
  };

  return (
    <section className="stack wide">
      <div className="card">
        <div className="card-header">
          <h1>Editar rutina</h1>
          <Link className="ghost-button" to="/routines">
            Volver a rutinas
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
            Guardar cambios
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
              const metricType = detail?.metricType ?? 'reps';
              const metricLabel =
                metricType === 'weight_reps'
                  ? 'Peso + reps'
                  : metricType === 'time'
                  ? 'Tiempo'
                  : metricType === 'distance'
                  ? 'Distancia'
                  : 'Reps';
              return (
                <li key={exercise.exerciseId} className="list-row list-row-stack">
                  <div>
                    <p className="list-title">{detail?.label ?? 'Ejercicio'}</p>
                    <p className="muted">
                      Orden #{index + 1} · Tipo {metricLabel}
                    </p>
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
                        step={5}
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
                  </div>
                  <div className="actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => handleReorder(exercise.exerciseId, 'up')}
                    >
                      Subir
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => handleReorder(exercise.exerciseId, 'down')}
                    >
                      Bajar
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => handleRemoveExercise(exercise.exerciseId)}
                    >
                      Quitar
                    </button>
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
