import { useEffect, useMemo, useState } from 'react';
import {
  createCustomExercise,
  getExerciseDisplayName,
  listExercises,
  listFavorites,
  listRecents,
  recordRecent,
  toggleFavorite,
  updateCustomExercise
} from '../data/exercises';
import { useSettings } from '../data/SettingsProvider';
import { ExerciseMetric } from '../data/db';

interface ExerciseSummary {
  id: string;
  label: string;
  muscles: string[];
  equipment: string[];
  metricType: ExerciseMetric;
  isCustom: boolean;
}

export function ExerciseCatalog() {
  const { settings } = useSettings();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');
  const [customMuscles, setCustomMuscles] = useState('');
  const [customEquipment, setCustomEquipment] = useState('');
  const [customMetric, setCustomMetric] = useState<ExerciseMetric>('weight_reps');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadExercises = async () => {
    const items = await listExercises({ query, muscle, equipment });
    setExercises(
      items.map((item) => ({
        id: item.id,
        label: getExerciseDisplayName(item, settings.language),
        muscles: item.muscles,
        equipment: item.equipment,
        metricType: item.metricType,
        isCustom: item.isCustom
      }))
    );
  };

  const loadFavorites = async () => {
    const data = await listFavorites();
    setFavorites(data.map((item) => item.exerciseId));
  };

  const loadRecents = async () => {
    const data = await listRecents();
    setRecents(data.map((item) => item.exerciseId));
  };

  useEffect(() => {
    loadExercises();
  }, [query, muscle, equipment, settings.language]);

  useEffect(() => {
    loadFavorites();
    loadRecents();
  }, []);

  const allMuscles = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((exercise) => exercise.muscles.forEach((item) => set.add(item)));
    return Array.from(set).sort();
  }, [exercises]);

  const allEquipment = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((exercise) => exercise.equipment.forEach((item) => set.add(item)));
    return Array.from(set).sort();
  }, [exercises]);

  const visibleExercises = useMemo(() => {
    const sorted = [...exercises].sort((a, b) => a.label.localeCompare(b.label));
    return sorted;
  }, [exercises]);

  const favoriteExercises = visibleExercises.filter((exercise) => favorites.includes(exercise.id));
  const recentExercises = visibleExercises.filter((exercise) => recents.includes(exercise.id));

  const handleFavorite = async (exerciseId: string) => {
    await toggleFavorite(exerciseId);
    await loadFavorites();
  };

  const handleRecent = async (exerciseId: string) => {
    await recordRecent(exerciseId);
    await loadRecents();
  };

  const resetCustomForm = () => {
    setCustomName('');
    setCustomMuscles('');
    setCustomEquipment('');
    setCustomMetric('weight_reps');
    setEditingId(null);
  };

  const handleCustomSave = async () => {
    setError('');
    const nameValue = customName.trim();
    if (!nameValue) {
      setError('El nombre es obligatorio.');
      return;
    }
    const musclesList = customMuscles
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const equipmentList = customEquipment
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!musclesList.length) {
      setError('Debes indicar al menos un músculo.');
      return;
    }
    if (!equipmentList.length) {
      setError('Debes indicar al menos un equipo.');
      return;
    }
    try {
      if (editingId) {
        await updateCustomExercise({
          id: editingId,
          name: nameValue,
          muscles: musclesList,
          equipment: equipmentList,
          metricType: customMetric
        });
      } else {
        await createCustomExercise({
          name: nameValue,
          muscles: musclesList,
          equipment: equipmentList,
          metricType: customMetric
        });
      }
      resetCustomForm();
      await loadExercises();
    } catch (err) {
      setError('Ya existe un ejercicio con ese nombre.');
    }
  };

  const handleEdit = (exercise: ExerciseSummary) => {
    setEditingId(exercise.id);
    setCustomName(exercise.label);
    setCustomMuscles(exercise.muscles.join(', '));
    setCustomEquipment(exercise.equipment.join(', '));
    setCustomMetric(exercise.metricType);
  };

  return (
    <section className="stack wide">
      <div className="card">
        <h1>Ejercicios</h1>
        <p className="muted">
          Busca por nombre, filtra por músculo o equipo y crea ejercicios personalizados.
        </p>
        <div className="field grid">
          <input
            type="search"
            placeholder="Buscar ejercicio"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={muscle} onChange={(event) => setMuscle(event.target.value)}>
            <option value="">Todos los músculos</option>
            {allMuscles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={equipment} onChange={(event) => setEquipment(event.target.value)}>
            <option value="">Todo el equipo</option>
            {allEquipment.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <h2>{editingId ? 'Editar ejercicio' : 'Nuevo ejercicio personalizado'}</h2>
        <div className="field">
          <input
            type="text"
            placeholder="Nombre"
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
          />
          <input
            type="text"
            placeholder="Músculos (separados por coma)"
            value={customMuscles}
            onChange={(event) => setCustomMuscles(event.target.value)}
          />
          <input
            type="text"
            placeholder="Equipo (separado por coma)"
            value={customEquipment}
            onChange={(event) => setCustomEquipment(event.target.value)}
          />
          <select
            value={customMetric}
            onChange={(event) => setCustomMetric(event.target.value as ExerciseMetric)}
          >
            <option value="weight_reps">Peso + repeticiones</option>
            <option value="reps">Repeticiones</option>
            <option value="time">Tiempo</option>
            <option value="distance">Distancia</option>
          </select>
          {error ? <p className="warning">{error}</p> : null}
          <div className="actions">
            <button className="primary-button" type="button" onClick={handleCustomSave}>
              {editingId ? 'Guardar cambios' : 'Crear ejercicio'}
            </button>
            {editingId ? (
              <button className="ghost-button" type="button" onClick={resetCustomForm}>
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Favoritos</h2>
        {favoriteExercises.length === 0 ? (
          <p className="muted">Marca ejercicios como favoritos para verlos aquí.</p>
        ) : (
          <ul className="list">
            {favoriteExercises.map((exercise) => (
              <li key={exercise.id} className="list-row">
                <div>
                  <p className="list-title">{exercise.label}</p>
                  <p className="muted">{exercise.muscles.join(', ') || 'Sin músculos'}</p>
                </div>
                <div className="actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => handleRecent(exercise.id)}
                  >
                    Marcar reciente
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => handleFavorite(exercise.id)}
                  >
                    Quitar favorito
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Recientes</h2>
        {recentExercises.length === 0 ? (
          <p className="muted">Los ejercicios usados recientemente aparecerán aquí.</p>
        ) : (
          <ul className="list">
            {recentExercises.map((exercise) => (
              <li key={exercise.id} className="list-row">
                <div>
                  <p className="list-title">{exercise.label}</p>
                  <p className="muted">{exercise.equipment.join(', ') || 'Sin equipo'}</p>
                </div>
                <div className="actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => handleFavorite(exercise.id)}
                  >
                    {favorites.includes(exercise.id) ? 'Quitar favorito' : 'Favorito'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Todos los ejercicios</h2>
        {visibleExercises.length === 0 ? (
          <p className="muted">No hay ejercicios que coincidan con la búsqueda.</p>
        ) : (
          <ul className="list">
            {visibleExercises.map((exercise) => (
              <li key={exercise.id} className="list-row">
                <div>
                  <p className="list-title">{exercise.label}</p>
                  <p className="muted">
                    {exercise.muscles.join(', ') || 'Sin músculos'} ·{' '}
                    {exercise.equipment.join(', ') || 'Sin equipo'}
                  </p>
                </div>
                <div className="actions">
                  {exercise.isCustom ? (
                    <button className="ghost-button" type="button" onClick={() => handleEdit(exercise)}>
                      Editar
                    </button>
                  ) : null}
                  <button className="ghost-button" type="button" onClick={() => handleRecent(exercise.id)}>
                    Marcar reciente
                  </button>
                  <button className="ghost-button" type="button" onClick={() => handleFavorite(exercise.id)}>
                    {favorites.includes(exercise.id) ? 'Quitar favorito' : 'Favorito'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
