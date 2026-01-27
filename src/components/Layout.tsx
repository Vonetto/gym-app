import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { OfflineBanner } from './OfflineBanner';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <OfflineBanner />
      <main className="app-main">{children}</main>
      <nav className="tab-bar">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Entrenamiento
        </NavLink>
        <NavLink to="/catalog" className={({ isActive }) => (isActive ? 'active' : '')}>
          Ejercicios
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          Perfil
        </NavLink>
      </nav>
    </div>
  );
}
