import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { useSettings } from './data/SettingsProvider';

export function App() {
  const { ready } = useSettings();

  if (!ready) {
    return (
      <div className="app loading">
        <div className="card">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
