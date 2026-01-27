import { useSettings } from '../data/SettingsProvider';

export function Settings() {
  const { settings, updateTheme } = useSettings();

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

    </section>
  );
}
