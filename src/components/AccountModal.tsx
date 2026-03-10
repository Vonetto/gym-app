import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../data/AuthProvider';
import { useSync } from '../data/SyncProvider';

type AccountView = 'landing' | 'sign_in' | 'sign_up' | 'account';

function getSyncButtonLabel(status: ReturnType<typeof useSync>['status']) {
  if (status === 'syncing') return 'Sincronizando...';
  if (status === 'success') return 'Sincronizado';
  if (status === 'error') return 'Reintentar sync';
  if (status === 'offline-pending') return 'Pendiente de sync';
  return 'Sincronizar ahora';
}

export function AccountModal() {
  const auth = useAuth();
  const sync = useSync();
  const [view, setView] = useState<AccountView>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncButtonLabel = getSyncButtonLabel(sync.status);

  const open = sync.onboardingOpen || sync.accountDialogOpen || Boolean(sync.migrationPrompt);

  useEffect(() => {
    if (!open) return;
    if (sync.migrationPrompt || auth.status === 'authenticated') {
      setView('account');
      setConfirmationEmail(null);
      return;
    }
    setView(sync.onboardingOpen ? 'landing' : 'sign_in');
  }, [auth.status, open, sync.migrationPrompt, sync.onboardingOpen]);

  const title = useMemo(() => {
    if (sync.migrationPrompt) return 'Elegir origen de datos';
    if (auth.status === 'authenticated') return 'Cuenta';
    if (view === 'sign_up') return 'Crear cuenta';
    if (view === 'sign_in') return 'Iniciar sesión';
    return 'Guardar y sincronizar';
  }, [auth.status, sync.migrationPrompt, view]);

  if (!open) return null;

  const close = () => {
    if (sync.onboardingOpen) return;
    sync.closeAccountDialog();
    setError(null);
    setConfirmationEmail(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (view === 'sign_up') {
        const result = await auth.signUp(email.trim(), password);
        if (result === 'confirmation_required') {
          setConfirmationEmail(email.trim());
          return;
        }
      } else {
        await auth.signIn(email.trim(), password);
        setConfirmationEmail(null);
      }
      sync.openAccountDialog();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No se pudo autenticar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay center" onClick={close}>
      <div className="modal-card account-modal" onClick={(event) => event.stopPropagation()}>
        <div className="training-header">
          <div>
            <h2>{title}</h2>
            {auth.isConfigured ? null : (
              <p className="muted">Falta configurar Supabase para usar cuentas y sync cloud.</p>
            )}
          </div>
          {!sync.onboardingOpen ? (
            <button className="ghost-button" type="button" onClick={close}>
              Cerrar
            </button>
          ) : null}
        </div>

        {sync.migrationPrompt ? (
          <div className="modal-section">
            <p className="muted">
              {sync.migrationPrompt.remoteHasData
                ? 'Hay datos locales y datos en la nube para esta cuenta. Elige cómo continuar.'
                : 'Hay datos locales en este dispositivo. Elige si quieres subirlos a esta cuenta o empezar limpio.'}
            </p>
            <div className="summary">
              <p className="metric-label">Datos locales detectados</p>
              <p className="metric-value">{sync.migrationPrompt.localCount}</p>
            </div>
            <div className="actions">
              <button className="primary-button" type="button" onClick={() => sync.resolveMigration('merge')}>
                {sync.migrationPrompt.remoteHasData ? 'Fusionar' : 'Subir datos locales'}
              </button>
              <button className="ghost-button" type="button" onClick={() => sync.resolveMigration('replace_local')}>
                {sync.migrationPrompt.remoteHasData ? 'Usar nube' : 'Empezar limpio'}
              </button>
            </div>
          </div>
        ) : null}

        {!sync.migrationPrompt && auth.status === 'authenticated' ? (
          <div className="modal-section">
            <div className="summary">
              <p className="metric-label">Sesión</p>
              <p className="metric-value">{auth.user?.email ?? 'Sin email'}</p>
            </div>
            <p className="muted">
              Sincronizar ahora sube tus rutinas, ejercicios personalizados, favoritos y
              entrenamientos a tu cuenta, y descarga cambios hechos desde otros dispositivos.
            </p>
            <div className="actions">
              <button
                className="primary-button"
                type="button"
                disabled={sync.status === 'syncing'}
                onClick={() => void sync.syncNow()}
              >
                {syncButtonLabel}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  void auth.signOut();
                  sync.closeAccountDialog();
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : null}

        {!sync.migrationPrompt &&
        auth.status !== 'authenticated' &&
        auth.status !== 'pending_confirmation' &&
        !confirmationEmail &&
        view === 'landing' ? (
          <div className="modal-section">
            <p className="muted">
              Crea una cuenta para sincronizar tus rutinas y entrenamientos. También puedes seguir
              usando la app solo en local.
            </p>
            <div className="actions-stack">
              <button className="primary-button full" type="button" onClick={() => setView('sign_up')}>
                Crear cuenta
              </button>
              <button className="ghost-button full" type="button" onClick={() => setView('sign_in')}>
                Iniciar sesión
              </button>
              <button className="ghost-button full" type="button" onClick={() => void sync.continueAsGuest()}>
                Continuar como invitado
              </button>
            </div>
          </div>
        ) : null}

        {!sync.migrationPrompt &&
        auth.status !== 'authenticated' &&
        auth.status !== 'pending_confirmation' &&
        !confirmationEmail &&
        (view === 'sign_in' || view === 'sign_up') ? (
          <div className="modal-section">
            <div className="field">
              <label className="label" htmlFor="account-email">
                Email
              </label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="account-password">
                Contraseña
              </label>
              <input
                id="account-password"
                type="password"
                autoComplete={view === 'sign_up' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            {error ? <p className="warning">{error}</p> : null}
            <div className="actions">
              <button
                className="primary-button"
                type="button"
                disabled={submitting || !email.trim() || password.length < 6 || !auth.isConfigured}
                onClick={() => void handleSubmit()}
              >
                {submitting ? 'Enviando...' : view === 'sign_up' ? 'Crear cuenta' : 'Entrar'}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setView(view === 'sign_up' ? 'sign_in' : sync.onboardingOpen ? 'landing' : 'sign_up')}
              >
                {view === 'sign_up'
                  ? 'Ya tengo cuenta'
                  : sync.onboardingOpen
                    ? 'Volver'
                    : 'Crear cuenta'}
              </button>
            </div>
          </div>
        ) : null}

        {auth.status === 'pending_confirmation' || confirmationEmail ? (
          <div className="modal-section">
            <div className="summary">
              <p className="metric-label">Confirmación pendiente</p>
              <p className="metric-value">{confirmationEmail ?? auth.pendingEmail ?? email}</p>
            </div>
            <p className="muted">
              Te enviamos un correo de confirmación. Abre tu email, confirma la cuenta y luego
              vuelve a iniciar sesión en la app.
            </p>
            <p className="muted">Si no lo encuentras, revisa spam o correo no deseado.</p>
            <div className="actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setConfirmationEmail(null);
                  setView('sign_in');
                }}
              >
                Volver a iniciar sesión
              </button>
              {!sync.onboardingOpen ? (
                <button className="primary-button" type="button" onClick={close}>
                  Entendido
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
