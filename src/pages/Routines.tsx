import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createRoutine, deleteRoutine, duplicateRoutine, listRoutines, reorderRoutine } from '../data/routines';

export function Routines() {
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [routines, setRoutines] = useState<Array<{ id: string; name: string; order: number }>>([]);
  const navigate = useNavigate();

  const loadRoutines = async () => {
    const data = await listRoutines();
    setRoutines(data);
  };

  useEffect(() => {
    loadRoutines();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const routine = await createRoutine(
      name.trim(),
      tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    );
    setName('');
    setTags('');
    await loadRoutines();
    navigate(`/routines/${routine.id}`);
  };

  const handleDuplicate = async (routineId: string) => {
    await duplicateRoutine(routineId);
    await loadRoutines();
  };

  const handleDelete = async (routineId: string) => {
    await deleteRoutine(routineId);
    await loadRoutines();
  };

  const handleReorder = async (routineId: string, direction: 'up' | 'down') => {
    await reorderRoutine(routineId, direction);
    await loadRoutines();
  };

  const handleStartEmpty = () => {
    const payload = {
      id: `session-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      exercises: []
    };
    localStorage.setItem('active-session', JSON.stringify(payload));
    navigate('/workout');
  };

  return (
    <section className="stack wide">
      <div className="card">
        <h1>Rutinas</h1>
        <p className="muted">Crea rutinas, organiza días y empieza sesiones rápidas.</p>
        <div className="field">
          <label className="label" htmlFor="routine-name">
            Nueva rutina
          </label>
          <input
            id="routine-name"
            type="text"
            value={name}
            placeholder="Ej: Día de empuje"
            onChange={(event) => setName(event.target.value)}
          />
          <input
            type="text"
            value={tags}
            placeholder="Tags o días (separados por coma)"
            onChange={(event) => setTags(event.target.value)}
          />
          <button className="primary-button" type="button" onClick={handleCreate}>
            Crear rutina
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Mis rutinas</h2>
          <button className="ghost-button" type="button" onClick={handleStartEmpty}>
            Empezar entrenamiento vacío
          </button>
        </div>
        {routines.length === 0 ? (
          <p className="muted">Aún no tienes rutinas creadas.</p>
        ) : (
          <ul className="list">
            {routines.map((routine, index) => (
              <li key={routine.id} className="list-row">
                <div>
                  <Link className="list-title" to={`/routines/${routine.id}`}>
                    {routine.name}
                  </Link>
                  <p className="muted">Orden #{index + 1}</p>
                </div>
                <div className="actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => handleReorder(routine.id, 'up')}
                  >
                    Subir
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => handleReorder(routine.id, 'down')}
                  >
                    Bajar
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => handleDuplicate(routine.id)}
                  >
                    Duplicar
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDelete(routine.id)}
                  >
                    Eliminar
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
