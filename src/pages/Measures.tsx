import { Link } from 'react-router-dom';

export function Measures() {
  return (
    <section className="stack wide">
      <div className="profile-header">
        <div>
          <p className="profile-name">Medidas</p>
          <p className="muted">Seguimiento corporal · próximamente</p>
        </div>
        <Link className="ghost-button" to="/profile">
          Volver
        </Link>
      </div>

      <div className="card">
        <h2>Próximamente</h2>
        <p className="muted">
          Aquí podrás registrar medidas corporales, fotos de progreso y un historial detallado.
        </p>
      </div>
    </section>
  );
}
