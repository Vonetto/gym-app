import { Link } from 'react-router-dom';

export function Home() {
  return (
    <section className="card">
      <h1>Bienvenido a Gym Tracker</h1>
      <p>
        Empieza creando tu primera rutina para registrar entrenamientos de forma
        rápida y offline.
      </p>
      <div className="actions">
        <Link className="primary-button" to="/routines">
          Crear rutina
        </Link>
        <Link className="ghost-button" to="/catalog">
          Explorar catálogo
        </Link>
      </div>
    </section>
  );
}
