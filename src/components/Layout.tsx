import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">Gym Tracker</div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Inicio
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            Ajustes
          </NavLink>
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
