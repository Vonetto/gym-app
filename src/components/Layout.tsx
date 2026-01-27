import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { OfflineBanner } from './OfflineBanner';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">Gym Tracker</div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Inicio
          </NavLink>
          <NavLink to="/routines" className={({ isActive }) => (isActive ? 'active' : '')}>
            Rutinas
          </NavLink>
          <NavLink to="/catalog" className={({ isActive }) => (isActive ? 'active' : '')}>
            Catálogo
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            Ajustes
          </NavLink>
        </nav>
      </header>
      <OfflineBanner />
      <main className="app-main">{children}</main>
    </div>
  );
}
