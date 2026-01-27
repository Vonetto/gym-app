import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../data/SettingsProvider';

export function Settings() {
  const { settings, updateTheme, resetAllData } = useSettings();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();

  const handleReset = async () => {
    setResetting(true);
    await resetAllData();
    setResetting(false);
    setConfirmingReset(false);
    navigate('/');
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

    </section>
  );
}
