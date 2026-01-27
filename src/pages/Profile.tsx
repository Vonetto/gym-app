import { Link } from 'react-router-dom';

export function Profile() {
  return (
    <section className="stack wide">
      <div className="profile-header">
        <div>
          <p className="profile-name">Tu perfil</p>
          <p className="muted">Resumen de entrenamientos y métricas</p>
        </div>
        <Link className="ghost-button" to="/settings">
          Ajustes
        </Link>
      </div>

      <div className="card">
        <h2>Actividad reciente</h2>
        <div className="chart">
          <div className="chart-bar" style={{ height: '40%' }} />
          <div className="chart-bar" style={{ height: '65%' }} />
          <div className="chart-bar" style={{ height: '25%' }} />
          <div className="chart-bar" style={{ height: '70%' }} />
          <div className="chart-bar" style={{ height: '45%' }} />
          <div className="chart-bar" style={{ height: '60%' }} />
        </div>
        <div className="pill-row">
          <span className="pill active">Duración</span>
          <span className="pill">Volumen</span>
          <span className="pill">Repeticiones</span>
        </div>
      </div>

      <div className="card">
        <h2>Información</h2>
        <div className="profile-grid">
          <button className="ghost-button" type="button">
            Estadísticas
          </button>
          <button className="ghost-button" type="button">
            Ejercicios
          </button>
          <button className="ghost-button" type="button">
            Medidas
          </button>
          <button className="ghost-button" type="button">
            Calendario
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Historial</h2>
        <p className="muted">Cuando completes entrenamientos, aparecerán aquí.</p>
      </div>
    </section>
  );
}
