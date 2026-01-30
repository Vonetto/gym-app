import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { useSettings } from './data/SettingsProvider';
import { seedExerciseCatalog } from './data/exercises';
import { RoutineDetail } from './pages/RoutineDetail';
import { ExerciseCatalog } from './pages/ExerciseCatalog';
import { Workout } from './pages/Workout';
import { Profile } from './pages/Profile';
import { Stats } from './pages/Stats';

export function App() {
  const { ready } = useSettings();

  useEffect(() => {
    if (ready) {
      seedExerciseCatalog();
    }
  }, [ready]);

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
        <Route path="/routines" element={<Navigate to="/" replace />} />
        <Route path="/routines/:routineId" element={<RoutineDetail />} />
        <Route path="/catalog" element={<ExerciseCatalog />} />
        <Route path="/workout" element={<Workout />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
