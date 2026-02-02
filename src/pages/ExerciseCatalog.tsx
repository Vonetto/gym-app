import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createCustomExercise,
  deleteCustomExercise,
  getExerciseDisplayName,
  listExercises,
  listFavorites,
  listRecents,
  normalizeName,
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
  normalizedLabel: string;
}

export function ExerciseCatalog() {
  const { settings } = useSettings();
  const [query, setQuery] = useState('');
  const [directoryTab, setDirectoryTab] = useState<'az' | 'muscle' | 'equipment'>('az');
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');
  const [customMuscles, setCustomMuscles] = useState<string[]>([]);
  const [customEquipment, setCustomEquipment] = useState<string[]>([]);
  const [customMetric, setCustomMetric] = useState<ExerciseMetric>('weight_reps');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showMuscleOptions, setShowMuscleOptions] = useState(false);
  const [showEquipmentOptions, setShowEquipmentOptions] = useState(false);

  const loadExercises = async () => {
    const items = await listExercises();
    setExercises(
      items.map((item) => {
        const label = getExerciseDisplayName(item, settings.language);
        return {
          id: item.id,
          label,
          muscles: item.muscles,
          equipment: item.equipment,
          metricType: item.metricType,
          isCustom: item.isCustom,
          normalizedLabel: normalizeName(label)
        };
      })
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
  }, [settings.language]);

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

  const muscleOptions = useMemo(() => {
    const set = new Set([...allMuscles, ...customMuscles]);
    return Array.from(set).sort();
  }, [allMuscles, customMuscles]);

  const equipmentOptions = useMemo(() => {
    const set = new Set([...allEquipment, ...customEquipment]);
    return Array.from(set).sort();
  }, [allEquipment, customEquipment]);

  const sortedExercises = useMemo(() => {
    const sorted = [...exercises].sort((a, b) => a.label.localeCompare(b.label));
    return sorted;
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    const normalizedQuery = normalizeName(query);
    return sortedExercises.filter((exercise) => {
      if (normalizedQuery && !exercise.normalizedLabel.includes(normalizedQuery)) {
        return false;
      }
      if (directoryTab === 'muscle' && selectedMuscle) {
        return exercise.muscles.includes(selectedMuscle);
      }
      if (directoryTab === 'equipment' && selectedEquipment) {
        return exercise.equipment.includes(selectedEquipment);
      }
      return true;
    });
  }, [sortedExercises, query, directoryTab, selectedMuscle, selectedEquipment]);

  const groupedByLetter = useMemo(() => {
    const groups = new Map<string, ExerciseSummary[]>();
    filteredExercises.forEach((exercise) => {
      const letter = exercise.normalizedLabel ? exercise.normalizedLabel[0].toUpperCase() : '#';
      const key = letter.match(/[A-Z]/) ? letter : '#';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(exercise);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredExercises]);

  const favoriteExercises = sortedExercises.filter((exercise) => favorites.includes(exercise.id));
  const recentExercises = sortedExercises.filter((exercise) => recents.includes(exercise.id));

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
    setCustomMuscles([]);
    setCustomEquipment([]);
    setCustomMetric('weight_reps');
    setEditingId(null);
    setShowMuscleOptions(false);
    setShowEquipmentOptions(false);
  };

  const handleCustomSave = async () => {
    setError('');
    const nameValue = customName.trim();
    if (!nameValue) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!customMuscles.length) {
      setError('Debes indicar al menos un músculo.');
      return;
    }
    if (!customEquipment.length) {
      setError('Debes indicar al menos un equipo.');
      return;
    }
    try {
      if (editingId) {
        await updateCustomExercise({
          id: editingId,
          name: nameValue,
          muscles: customMuscles,
          equipment: customEquipment,
          metricType: customMetric
        });
      } else {
        await createCustomExercise({
          name: nameValue,
          muscles: customMuscles,
          equipment: customEquipment,
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
    setCustomMuscles(exercise.muscles);
    setCustomEquipment(exercise.equipment);
    setCustomMetric(exercise.metricType);
    setShowMuscleOptions(false);
    setShowEquipmentOptions(false);
  };

  const handleDelete = async (exercise: ExerciseSummary) => {
    if (!exercise.isCustom) return;
    const confirmed = window.confirm(
      '¿Eliminar este ejercicio personalizado? Se quitará de rutinas futuras.'
    );
    if (!confirmed) return;
    await deleteCustomExercise(exercise.id);
    if (editingId === exercise.id) {
      resetCustomForm();
    }
    await loadExercises();
    await loadFavorites();
    await loadRecents();
  };

  const toggleSelection = (
    value: string,
    current: string[],
    setter: (next: string[]) => void
  ) => {
    if (current.includes(value)) {
      setter(current.filter((item) => item !== value));
    } else {
      setter([...current, value]);
    }
  };

  const getMetaLabel = (exercise: ExerciseSummary) => {
    const primaryMuscle = exercise.muscles[0] ?? 'Sin músculo';
    const primaryEquipment = exercise.equipment[0] ?? 'Sin equipo';
    return `${primaryMuscle} · ${primaryEquipment}`;
  };

  return (
    <section className="stack wide">
      <div className="card">
        <h1>Ejercicios</h1>
        <p className="muted">Explora ejercicios por A‑Z, músculo o equipo.</p>
        <div className="field">
          <input
            type="search"
            placeholder="Buscar ejercicio"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="pill-row">
          <button
            className={`pill ${directoryTab === 'az' ? 'active' : ''}`}
            type="button"
            onClick={() => setDirectoryTab('az')}
          >
            A‑Z
          </button>
          <button
            className={`pill ${directoryTab === 'muscle' ? 'active' : ''}`}
            type="button"
            onClick={() => setDirectoryTab('muscle')}
          >
            Músculo
          </button>
          <button
            className={`pill ${directoryTab === 'equipment' ? 'active' : ''}`}
            type="button"
            onClick={() => setDirectoryTab('equipment')}
          >
            Equipo
          </button>
        </div>
        {directoryTab === 'muscle' ? (
          <div className="chip-grid directory-chips">
            <button
              className={`select-chip ${!selectedMuscle ? 'active' : ''}`}
              type="button"
              onClick={() => setSelectedMuscle('')}
            >
              Todos
            </button>
            {allMuscles.map((item) => (
              <button
                key={item}
                className={`select-chip ${selectedMuscle === item ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedMuscle(item)}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        {directoryTab === 'equipment' ? (
          <div className="chip-grid directory-chips">
            <button
              className={`select-chip ${!selectedEquipment ? 'active' : ''}`}
              type="button"
              onClick={() => setSelectedEquipment('')}
            >
              Todo
            </button>
            {allEquipment.map((item) => (
              <button
                key={item}
                className={`select-chip ${selectedEquipment === item ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedEquipment(item)}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
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
          <div className="field">
            <label className="label">Músculos</label>
            <button
              className="select-field"
              type="button"
              onClick={() => setShowMuscleOptions((prev) => !prev)}
            >
              <span>
                {customMuscles.length ? customMuscles.join(', ') : 'Selecciona músculos'}
              </span>
              <span className="select-caret">{showMuscleOptions ? '▲' : '▼'}</span>
            </button>
            {showMuscleOptions ? (
              <div className="chip-grid">
                {muscleOptions.map((item) => (
                  <button
                    key={item}
                    className={`select-chip ${customMuscles.includes(item) ? 'active' : ''}`}
                    type="button"
                    onClick={() => toggleSelection(item, customMuscles, setCustomMuscles)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="field">
            <label className="label">Equipo</label>
            <button
              className="select-field"
              type="button"
              onClick={() => setShowEquipmentOptions((prev) => !prev)}
            >
              <span>
                {customEquipment.length ? customEquipment.join(', ') : 'Selecciona equipo'}
              </span>
              <span className="select-caret">{showEquipmentOptions ? '▲' : '▼'}</span>
            </button>
            {showEquipmentOptions ? (
              <div className="chip-grid">
                {equipmentOptions.map((item) => (
                  <button
                    key={item}
                    className={`select-chip ${customEquipment.includes(item) ? 'active' : ''}`}
                    type="button"
                    onClick={() => toggleSelection(item, customEquipment, setCustomEquipment)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
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
                  <Link className="list-link" to={`/exercises/${exercise.id}`}>
                    <p className="list-title">{exercise.label}</p>
                    <p className="muted">{getMetaLabel(exercise)}</p>
                  </Link>
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
                  <Link className="list-link" to={`/exercises/${exercise.id}`}>
                    <p className="list-title">{exercise.label}</p>
                    <p className="muted">{getMetaLabel(exercise)}</p>
                  </Link>
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
        <h2>Directorio</h2>
        {filteredExercises.length === 0 ? (
          <p className="muted">No hay ejercicios que coincidan con la búsqueda.</p>
        ) : directoryTab === 'az' ? (
          <div className="list-sections">
            {groupedByLetter.map(([letter, items]) => (
              <div key={letter} className="list-section">
                <p className="section-title">{letter}</p>
                <ul className="list">
                  {items.map((exercise) => (
                    <li key={exercise.id} className="list-row">
                      <div>
                        <Link className="list-link" to={`/exercises/${exercise.id}`}>
                          <p className="list-title">{exercise.label}</p>
                          <p className="muted">{getMetaLabel(exercise)}</p>
                        </Link>
                      </div>
                      <div className="actions-stack">
                        <div className="actions">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => handleFavorite(exercise.id)}
                          >
                            {favorites.includes(exercise.id) ? 'Quitar favorito' : 'Favorito'}
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => handleRecent(exercise.id)}
                          >
                            Marcar reciente
                          </button>
                        </div>
                        {exercise.isCustom ? (
                          <div className="actions">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => handleEdit(exercise)}
                            >
                              Editar
                            </button>
                            <button
                              className="ghost-button danger"
                              type="button"
                              onClick={() => handleDelete(exercise)}
                            >
                              Eliminar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="list">
            {filteredExercises.map((exercise) => (
              <li key={exercise.id} className="list-row">
                <div>
                  <Link className="list-link" to={`/exercises/${exercise.id}`}>
                    <p className="list-title">{exercise.label}</p>
                    <p className="muted">{getMetaLabel(exercise)}</p>
                  </Link>
                </div>
                <div className="actions-stack">
                  <div className="actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => handleFavorite(exercise.id)}
                    >
                      {favorites.includes(exercise.id) ? 'Quitar favorito' : 'Favorito'}
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => handleRecent(exercise.id)}
                    >
                      Marcar reciente
                    </button>
                  </div>
                  {exercise.isCustom ? (
                    <div className="actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleEdit(exercise)}
                      >
                        Editar
                      </button>
                      <button
                        className="ghost-button danger"
                        type="button"
                        onClick={() => handleDelete(exercise)}
                      >
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
