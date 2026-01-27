import { useMemo } from 'react';
import { Link } from 'react-router-dom';

export function Workout() {
  const session = useMemo(() => {
    const stored = localStorage.getItem('active-session');
    return stored ? JSON.parse(stored) : null;
  }, []);

  return (
    <section className="card">
      <h1>Sesión en blanco</h1>
      <p className="muted">
        {session
          ? 'Se creó una sesión vacía para registrar tu entrenamiento libre.'
          : 'No hay una sesión activa en este momento.'}
      </p>
      {session ? (
        <div className="summary">
          <p>
            <strong>ID:</strong> {session.id}
          </p>
          <p>
            <strong>Creada:</strong> {new Date(session.createdAt).toLocaleString()}
          </p>
        </div>
      ) : null}
      <Link className="ghost-button" to="/routines">
        Volver a rutinas
      </Link>
    </section>
  );
}
