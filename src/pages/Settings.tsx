import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../data/SettingsProvider';
import { exportRoutineBackup, importRoutineBackup } from '../data/routineBackup';
import { listRoutines } from '../data/routines';

export function Settings() {
  const { settings, updateTheme, resetAllData } = useSettings();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [routines, setRoutines] = useState<Array<{ id: string; name: string }>>([]);
  const [routineId, setRoutineId] = useState('');
  const navigate = useNavigate();

  const handleReset = async () => {
    setResetting(true);
    await resetAllData();
    setResetting(false);
    setConfirmingReset(false);
    navigate('/');
  };

  const loadRoutines = async () => {
    const data = await listRoutines();
    setRoutines(data.map((routine) => ({ id: routine.id, name: routine.name })));
  };

  useEffect(() => {
    loadRoutines();
  }, []);

  const handleExportRoutine = async () => {
    if (!routineId) return;
    setExporting(true);
    try {
      const payload = await exportRoutineBackup(routineId);
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `gym-tracker-rutina-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleImportRoutine = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await importRoutineBackup(payload);
      await loadRoutines();
      alert('Rutina importada.');
    } catch {
      alert('No se pudo importar la rutina.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <section className="stack">
      <div className="card">
        <h1>Ajustes</h1>
        <p className="muted">Configura el tema y gestiona tus datos locales.</p>
        <div className="field">
          <span className="label">Tema</span>
          <div className="toggle-group" role="group" aria-label="Tema">
            <button
              type="button"
              className={settings.theme === 'dark' ? 'toggle active' : 'toggle'}
              onClick={() => updateTheme('dark')}
            >
              Oscuro
            </button>
            <button
              type="button"
              className={settings.theme === 'light' ? 'toggle active' : 'toggle'}
              onClick={() => updateTheme('light')}
            >
              Claro
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Importar / Exportar rutina</h2>
        <p className="muted">Comparte rutinas como archivo JSON.</p>
        <div className="field">
          <label className="label" htmlFor="routine-export">
            Exportar rutina
          </label>
          <select
            id="routine-export"
            value={routineId}
            onChange={(event) => setRoutineId(event.target.value)}
          >
            <option value="">Selecciona una rutina</option>
            {routines.map((routine) => (
              <option key={routine.id} value={routine.id}>
                {routine.name}
              </option>
            ))}
          </select>
          <button
            className="ghost-button"
            type="button"
            onClick={handleExportRoutine}
            disabled={!routineId || exporting}
          >
            {exporting ? 'Exportando...' : 'Exportar rutina'}
          </button>
        </div>
        <div className="field">
          <label className="label" htmlFor="routine-import">
            Importar rutina
          </label>
          <label className="ghost-button" htmlFor="routine-import">
            {importing ? 'Importando...' : 'Seleccionar archivo'}
          </label>
          <input
            id="routine-import"
            type="file"
            accept="application/json"
            onChange={handleImportRoutine}
            style={{ display: 'none' }}
            disabled={importing}
          />
        </div>
      </div>

      <div className="card danger">
        <h2>Resetear datos</h2>
        <p>
          Esta acción elimina todos tus datos locales. Exporta tu información antes
          de continuar.
        </p>
        {!confirmingReset ? (
          <button className="ghost-button" type="button" onClick={() => setConfirmingReset(true)}>
            Resetear datos
          </button>
        ) : (
          <div className="confirm">
            <p className="warning">¿Seguro que deseas borrar todo?</p>
            <div className="actions">
              <button
                className="danger-button"
                type="button"
                onClick={handleReset}
                disabled={resetting}
              >
                {resetting ? 'Reseteando...' : 'Confirmar reset'}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setConfirmingReset(false)}
                disabled={resetting}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Créditos</h2>
        <p className="muted">
          El catálogo inicial de ejercicios se basa en datos del proyecto wger.
        </p>
        <p>
          Fuente: <a href="https://wger.de/en/software/api">wger API</a> · Licencia{' '}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
        </p>
      </div>
    </section>
  );
}
