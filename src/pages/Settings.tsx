import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../data/SettingsProvider';
import { useAuth } from '../data/AuthProvider';
import { useSync } from '../data/SyncProvider';
import { exportRoutineBackup, importRoutineBackup } from '../data/routineBackup';
import {
  exportFullBackup,
  getBackupSnapshot,
  importFullBackup,
  parseAndValidateFullBackupFile,
  previewFullBackup,
  type FullBackupImportMode,
  type FullBackupPreview,
  type FullBackupImportResult,
  type FullBackupPayload
} from '../data/fullBackup';
import { listRoutines } from '../data/routines';
import {
  getCurrentPushSubscription,
  getNotificationCapability,
  getNotificationStatusLabel,
  hasPushPublicKey,
  requestNotificationPermission
} from '../data/notifications';
import { subscribeDeviceToPush, unsubscribeDeviceFromPush } from '../data/notifications';

function getFullBackupErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'No se pudo procesar el backup.';
  switch (error.message) {
    case 'file-too-large':
      return 'Archivo demasiado grande. Usa un backup menor a 20MB.';
    case 'invalid-json':
      return 'Archivo corrupto: el JSON no es válido.';
    case 'wrong-backup-type':
      return 'Este archivo corresponde a una rutina individual, no a backup total.';
    case 'unsupported-schema-version':
      return 'Versión de backup no soportada.';
    case 'incomplete-backup':
      return 'Archivo incompleto: faltan campos obligatorios.';
    case 'corrupt-backup':
      return 'Archivo corrupto: referencias inválidas en el backup.';
    case 'invalid-backup':
      return 'Archivo inválido para backup total.';
    default:
      return 'No se pudo procesar el backup.';
  }
}

type SettingsSection =
  | 'home'
  | 'appearance'
  | 'notifications'
  | 'data'
  | 'integrations'
  | 'maintenance'
  | 'credits';

const SETTINGS_SECTION_META: Record<
  Exclude<SettingsSection, 'home'>,
  { title: string; description: string }
> = {
  appearance: {
    title: 'Apariencia',
    description: 'Tema de la app y rango de estadísticas.'
  },
  notifications: {
    title: 'Notificaciones',
    description: 'Permisos, avisos y push del dispositivo.'
  },
  data: {
    title: 'Datos',
    description: 'Backup total e import/export de rutinas.'
  },
  integrations: {
    title: 'Integraciones',
    description: 'Configuraciones opcionales de proveedores externos.'
  },
  maintenance: {
    title: 'Mantenimiento',
    description: 'Actualizar app y gestionar reset local.'
  },
  credits: {
    title: 'Créditos',
    description: 'Fuentes de datos y licencias.'
  }
};

export function Settings() {
  const {
    settings,
    updateTheme,
    updateStatsRange,
    updateWrkoutApiKey,
    updateNotificationSettings,
    resetAllData
  } = useSettings();
  const { user, status } = useAuth();
  const { syncNow, isOnline } = useSync();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fullBackupExporting, setFullBackupExporting] = useState(false);
  const [fullBackupImporting, setFullBackupImporting] = useState(false);
  const [fullBackupPayload, setFullBackupPayload] = useState<FullBackupPayload | null>(null);
  const [fullBackupMode, setFullBackupMode] = useState<FullBackupImportMode>('merge');
  const [fullBackupStep, setFullBackupStep] = useState<1 | 2 | 3>(1);
  const [fullBackupError, setFullBackupError] = useState<string | null>(null);
  const [fullBackupPreviewData, setFullBackupPreviewData] = useState<FullBackupPreview | null>(
    null
  );
  const [fullBackupResult, setFullBackupResult] = useState<FullBackupImportResult | null>(null);
  const [replaceConfirmText, setReplaceConfirmText] = useState('');
  const [downloadingAutoBackup, setDownloadingAutoBackup] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('home');
  const [routines, setRoutines] = useState<Array<{ id: string; name: string }>>([]);
  const [routineId, setRoutineId] = useState('');
  const [wrkoutKey, setWrkoutKey] = useState(settings.wrkoutApiKey ?? '');
  const [notificationCapability, setNotificationCapability] = useState(() =>
    getNotificationCapability()
  );
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pwaRefreshing, setPwaRefreshing] = useState(false);
  const [pwaStatusMessage, setPwaStatusMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const statsRangeDays = settings.statsRangeDays ?? 30;
  const notificationStatus = getNotificationStatusLabel(notificationCapability);
  const pushConfigured = hasPushPublicKey();

  const refreshNotificationCapability = () => {
    setNotificationCapability(getNotificationCapability());
  };

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

  useEffect(() => {
    setWrkoutKey(settings.wrkoutApiKey ?? '');
  }, [settings.wrkoutApiKey]);

  useEffect(() => {
    refreshNotificationCapability();
    const handleVisibility = () => {
      refreshNotificationCapability();
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const loadPushState = async () => {
      const subscription = await getCurrentPushSubscription();
      setPushSubscribed(Boolean(subscription));
    };
    void loadPushState();
  }, [notificationCapability.permission, notificationCapability.pushSupported]);

  const handleWrkoutSave = async () => {
    await updateWrkoutApiKey(wrkoutKey.trim());
  };

  const handleNotificationPermission = async () => {
    setRequestingPermission(true);
    try {
      await requestNotificationPermission();
    } finally {
      refreshNotificationCapability();
      setRequestingPermission(false);
    }
  };

  const handlePushSubscription = async () => {
    if (!user) return;
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        await unsubscribeDeviceFromPush(user.id);
        setPushSubscribed(false);
      } else {
        await subscribeDeviceToPush(user.id);
        setPushSubscribed(true);
      }
    } finally {
      setPushBusy(false);
    }
  };

  const syncNotificationPreferencesNow = async () => {
    if (!user || status !== 'authenticated' || !isOnline) return;
    await syncNow('merge');
  };

  const updateNotificationSettingsAndSync = async (
    patch: Parameters<typeof updateNotificationSettings>[0]
  ) => {
    await updateNotificationSettings(patch);
    await syncNotificationPreferencesNow();
  };

  const waitForControllerChange = (timeoutMs = 1500) =>
    new Promise<void>((resolve) => {
      if (!('serviceWorker' in navigator)) {
        resolve();
        return;
      }

      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        navigator.serviceWorker.removeEventListener('controllerchange', onChange);
        resolve();
      };
      const onChange = () => finish();
      navigator.serviceWorker.addEventListener('controllerchange', onChange);
      window.setTimeout(finish, timeoutMs);
    });

  const handleRefreshPwa = async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) {
      setPwaStatusMessage('Este navegador no soporta PWA.');
      return;
    }

    setPwaRefreshing(true);
    setPwaStatusMessage('Buscando actualizaciones...');
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update()));

      let waitingFound = false;
      registrations.forEach((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          waitingFound = true;
        }
      });

      let clearedCaches = 0;
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys.map(async (key) => {
            const deleted = await caches.delete(key);
            if (deleted) clearedCaches += 1;
          })
        );
      }

      if (waitingFound) {
        await waitForControllerChange();
      }

      setPwaStatusMessage(
        `App actualizada. Caché limpiada (${clearedCaches}). Recargando...`
      );
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('refresh', Date.now().toString());
      window.location.replace(nextUrl.toString());
    } catch {
      setPwaStatusMessage('No se pudo actualizar la app. Intenta nuevamente.');
      setPwaRefreshing(false);
    }
  };

  const handleGlobalNotificationsToggle = async () => {
    if (settings.notificationsEnabled) {
      await updateNotificationSettingsAndSync({
        notificationsEnabled: false,
        plannedWorkoutNotificationsEnabled: false,
        restFinishedNotificationsEnabled: false,
        backgroundSessionNotificationsEnabled: false
      });
      return;
    }

    if (!notificationCapability.supported) {
      alert('Este navegador no soporta notificaciones.');
      return;
    }

    let permission = notificationCapability.permission;
    if (permission !== 'granted') {
      setRequestingPermission(true);
      try {
        permission = await requestNotificationPermission();
      } finally {
        setRequestingPermission(false);
      }
      refreshNotificationCapability();
    }

    if (permission !== 'granted') {
      await updateNotificationSettingsAndSync({
        notificationsEnabled: false,
        plannedWorkoutNotificationsEnabled: false,
        restFinishedNotificationsEnabled: false,
        backgroundSessionNotificationsEnabled: false
      });
      return;
    }

    await updateNotificationSettingsAndSync({
      notificationsEnabled: true,
      plannedWorkoutNotificationsEnabled: true,
      restFinishedNotificationsEnabled: true,
      backgroundSessionNotificationsEnabled: true
    });

    const capability = getNotificationCapability();
    setNotificationCapability(capability);
    if (
      user &&
      status === 'authenticated' &&
      capability.pushSupported &&
      pushConfigured &&
      capability.permission === 'granted'
    ) {
      try {
        await subscribeDeviceToPush(user.id);
        setPushSubscribed(true);
      } catch {
        // Si falla la suscripción automática, el usuario puede reintentar manualmente.
      }
    }
  };

  const toggleNotificationType = async (
    key:
      | 'plannedWorkoutNotificationsEnabled'
      | 'restFinishedNotificationsEnabled'
      | 'backgroundSessionNotificationsEnabled'
  ) => {
    await updateNotificationSettingsAndSync({
      [key]: !settings[key]
    });
  };

  const resetFullBackupFlow = () => {
    setFullBackupPayload(null);
    setFullBackupPreviewData(null);
    setFullBackupError(null);
    setFullBackupStep(1);
    setFullBackupMode('merge');
    setReplaceConfirmText('');
  };

  const handleExportFullBackup = async () => {
    setFullBackupExporting(true);
    setFullBackupError(null);
    try {
      const payload = await exportFullBackup();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `gym-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFullBackupError(getFullBackupErrorMessage(error));
    } finally {
      setFullBackupExporting(false);
    }
  };

  const handleSelectFullBackupFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFullBackupError(null);
    setFullBackupResult(null);
    setFullBackupImporting(true);
    try {
      const payload = await parseAndValidateFullBackupFile(file);
      setFullBackupPayload(payload);
      setFullBackupPreviewData(previewFullBackup(payload));
      setFullBackupStep(2);
      setReplaceConfirmText('');
    } catch (error) {
      setFullBackupError(getFullBackupErrorMessage(error));
      setFullBackupPayload(null);
      setFullBackupPreviewData(null);
      setFullBackupStep(1);
      setReplaceConfirmText('');
    } finally {
      setFullBackupImporting(false);
      event.target.value = '';
    }
  };

  const handleApplyFullBackup = async () => {
    if (!fullBackupPayload) return;
    if (fullBackupMode === 'replace' && replaceConfirmText.trim() !== 'REEMPLAZAR') {
      setFullBackupError('Debes escribir REEMPLAZAR para confirmar este modo.');
      return;
    }

    setFullBackupImporting(true);
    setFullBackupError(null);
    try {
      const result = await importFullBackup(fullBackupPayload, fullBackupMode);
      await loadRoutines();
      setFullBackupResult(result);
      setFullBackupPayload(null);
      setFullBackupPreviewData(null);
      setFullBackupStep(1);
      setReplaceConfirmText('');
      alert('Backup importado correctamente.');
    } catch (error) {
      setFullBackupError(getFullBackupErrorMessage(error));
    } finally {
      setFullBackupImporting(false);
    }
  };

  const handleDownloadAutoBackup = async () => {
    if (!fullBackupResult) return;
    setDownloadingAutoBackup(true);
    try {
      const snapshot = await getBackupSnapshot(fullBackupResult.autoBackup.id);
      if (!snapshot) {
        setFullBackupError('No se encontró el auto-backup previo.');
        return;
      }
      const blob = new Blob([snapshot.payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `gym-tracker-auto-backup-${snapshot.createdAt.slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingAutoBackup(false);
    }
  };

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

  if (activeSection === 'home') {
    const sections: Array<{
      id: Exclude<SettingsSection, 'home'>;
      title: string;
      description: string;
    }> = [
      { id: 'appearance', title: 'Apariencia', description: 'Tema y rango de estadísticas.' },
      { id: 'notifications', title: 'Notificaciones', description: 'Permisos, avisos y push.' },
      { id: 'data', title: 'Datos', description: 'Backup total y rutinas JSON.' },
      { id: 'maintenance', title: 'Mantenimiento', description: 'Actualizar app y reset local.' },
      { id: 'integrations', title: 'Integraciones', description: 'Llaves y servicios externos.' },
      { id: 'credits', title: 'Créditos', description: 'Fuentes y licencias.' }
    ];

    return (
      <section className="stack">
        <div className="card">
          <h1>Ajustes</h1>
          <p className="muted">Selecciona una sección para editar la configuración.</p>
          <div className="settings-nav-list">
            {sections.map((section) => (
              <button
                key={section.id}
                className="settings-nav-item"
                type="button"
                onClick={() => setActiveSection(section.id)}
              >
                <span>
                  <strong>{section.title}</strong>
                  <small>{section.description}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const sectionMeta = SETTINGS_SECTION_META[activeSection];

  return (
    <section className="stack">
      <div className="card settings-section-header">
        <button className="ghost-button" type="button" onClick={() => setActiveSection('home')}>
          Volver a Ajustes
        </button>
        <p className="muted settings-breadcrumb">Ajustes / {sectionMeta.title}</p>
        <h1>{sectionMeta.title}</h1>
        <p className="muted">{sectionMeta.description}</p>
      </div>

      {activeSection === 'appearance' ? (
        <div className="card">
          <h2>Apariencia</h2>
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
          <div className="field">
            <span className="label">Rango de estadísticas</span>
            <div className="toggle-group" role="group" aria-label="Rango de estadísticas">
              {[7, 30, 180, 365].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={statsRangeDays === days ? 'toggle active' : 'toggle'}
                  onClick={() => updateStatsRange(days as 7 | 30 | 180 | 365)}
                >
                  {days} días
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === 'notifications' ? (
        <div className="card">
          <h2>Notificaciones</h2>
          <p className="muted">
            Activa todo de una vez y luego oculta solo los avisos que no quieras ver.
          </p>

          <div className="field">
            <div className="notification-master">
              <div>
                <p className="list-title">Notificaciones de la app</p>
                <p className="muted">
                  {settings.notificationsEnabled ? 'Activadas' : 'Desactivadas'}
                </p>
              </div>
              <button
                className={settings.notificationsEnabled ? 'danger-button' : 'primary-button'}
                type="button"
                onClick={handleGlobalNotificationsToggle}
                disabled={requestingPermission || !notificationCapability.supported}
              >
                {requestingPermission
                  ? 'Activando...'
                  : settings.notificationsEnabled
                    ? 'Desactivar notificaciones'
                    : 'Activar notificaciones'}
              </button>
            </div>
            <div className="notification-system-status">
              <p className="muted">
                Permiso del sistema: <strong>{notificationStatus}</strong>
              </p>
              {!notificationCapability.supported ? (
                <p className="muted">Este navegador no soporta notificaciones del sistema.</p>
              ) : null}
              {notificationCapability.permission === 'denied' ? (
                <p className="muted">
                  El permiso está bloqueado. Debes habilitarlo desde ajustes del navegador/iPhone.
                </p>
              ) : null}
              {notificationCapability.permission !== 'granted' &&
              notificationCapability.permission !== 'denied' ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={handleNotificationPermission}
                  disabled={requestingPermission}
                >
                  Reintentar permiso
                </button>
              ) : null}
              <p className="muted">
                {notificationCapability.requiresStandaloneForPush
                  ? 'Si estás en iPhone, abre esta app desde pantalla de inicio y vuelve aquí para permitir notificaciones.'
                  : 'Cuando el sistema lo soporte, la app podrá avisarte aunque esté en segundo plano.'}
              </p>
            </div>
          </div>

          {settings.notificationsEnabled ? (
            <>
              <div className="list-row list-row-stack">
                <span className="list-title">Zona horaria del recordatorio</span>
                <span className="muted">{settings.notificationTimezone ?? 'UTC'}</span>
              </div>
              <div className="field">
                <span className="label">Tipos de aviso</span>
                <div className="notification-option-list">
                  <div className="notification-option-row">
                    <div className="notification-option-copy">
                      <p className="list-title">Rutina planificada</p>
                      <p className="muted">Recordatorio diario para rutinas agendadas.</p>
                    </div>
                    <button
                      type="button"
                      className={
                        settings.plannedWorkoutNotificationsEnabled ? 'ghost-button' : 'toggle active'
                      }
                      onClick={() => toggleNotificationType('plannedWorkoutNotificationsEnabled')}
                    >
                      {settings.plannedWorkoutNotificationsEnabled
                        ? 'No mostrar esta notificación'
                        : 'Mostrar'}
                    </button>
                  </div>
                  <div className="notification-option-row">
                    <div className="notification-option-copy">
                      <p className="list-title">Descanso</p>
                      <p className="muted">Aviso y silbato cuando termina el descanso.</p>
                    </div>
                    <button
                      type="button"
                      className={settings.restFinishedNotificationsEnabled ? 'ghost-button' : 'toggle active'}
                      onClick={() => toggleNotificationType('restFinishedNotificationsEnabled')}
                    >
                      {settings.restFinishedNotificationsEnabled
                        ? 'No mostrar esta notificación'
                        : 'Mostrar'}
                    </button>
                  </div>
                  <div className="notification-option-row">
                    <div className="notification-option-copy">
                      <p className="list-title">“¿Sigues entrenando?”</p>
                      <p className="muted">Aviso si sales de la app con una sesión activa.</p>
                    </div>
                    <button
                      type="button"
                      className={
                        settings.backgroundSessionNotificationsEnabled ? 'ghost-button' : 'toggle active'
                      }
                      onClick={() => toggleNotificationType('backgroundSessionNotificationsEnabled')}
                    >
                      {settings.backgroundSessionNotificationsEnabled
                        ? 'No mostrar esta notificación'
                        : 'Mostrar'}
                    </button>
                  </div>
                </div>
                <p className="muted">
                  En iPhone, los avisos push confiables en segundo plano aplican a rutinas planificadas.
                  Descanso y “¿Sigues entrenando?” dependen del estado activo de la app.
                </p>
              </div>

              {settings.plannedWorkoutNotificationsEnabled ? (
                <div className="field">
                  <span className="label">Recordatorio de rutina planificada</span>
                  <div className="field grid">
                    <label className="actions-stack">
                      <span className="label">Hora global</span>
                      <input
                        type="time"
                        value={settings.plannedReminderTime ?? '19:00'}
                        onChange={(event) =>
                          void updateNotificationSettingsAndSync({
                            plannedReminderTime: event.target.value
                          })
                        }
                      />
                    </label>
                    <label className="actions-stack">
                      <span className="label">Avisar</span>
                      <select
                        value={settings.plannedReminderOffsetMinutes ?? 0}
                        onChange={(event) =>
                          void updateNotificationSettingsAndSync({
                            plannedReminderOffsetMinutes: Number(event.target.value)
                          })
                        }
                      >
                        <option value={0}>A la hora exacta</option>
                        <option value={5}>5 min antes</option>
                        <option value={10}>10 min antes</option>
                        <option value={15}>15 min antes</option>
                        <option value={30}>30 min antes</option>
                        <option value={60}>1 hora antes</option>
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}

              {settings.backgroundSessionNotificationsEnabled ? (
                <div className="field">
                  <label className="actions-stack">
                    <span className="label">Umbral para “¿Sigues entrenando?”</span>
                    <select
                      value={settings.backgroundSessionReminderDelayMinutes ?? 10}
                      onChange={(event) =>
                        void updateNotificationSettingsAndSync({
                          backgroundSessionReminderDelayMinutes: Number(event.target.value)
                        })
                      }
                    >
                      <option value={5}>5 min</option>
                      <option value={10}>10 min</option>
                      <option value={15}>15 min</option>
                      <option value={20}>20 min</option>
                      <option value={30}>30 min</option>
                    </select>
                  </label>
                </div>
              ) : null}

              <div className="field">
                <span className="label">Push del dispositivo (cuenta)</span>
                <div className="list-row">
                  <span className="list-title">Estado</span>
                  <span>{pushSubscribed ? 'Suscrito' : 'No suscrito'}</span>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={handlePushSubscription}
                  disabled={
                    pushBusy ||
                    !user ||
                    status !== 'authenticated' ||
                    !notificationCapability.pushSupported ||
                    !pushConfigured ||
                    notificationCapability.permission !== 'granted'
                  }
                >
                  {pushBusy
                    ? 'Actualizando...'
                    : pushSubscribed
                      ? 'Desactivar push'
                      : 'Activar push'}
                </button>
                <p className="muted">
                  {!user || status !== 'authenticated'
                    ? 'Inicia sesión para asociar este dispositivo a recordatorios de rutinas.'
                    : !pushConfigured
                      ? 'Falta configurar la VAPID public key en el frontend.'
                      : notificationCapability.permission !== 'granted'
                        ? 'Debes otorgar permiso del sistema primero.'
                        : notificationCapability.requiresStandaloneForPush &&
                            !notificationCapability.isStandalone
                          ? 'En iPhone debes abrir la app desde pantalla de inicio.'
                          : 'Este dispositivo ya puede recibir recordatorios de rutinas planificadas.'}
                </p>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {activeSection === 'data' ? (
        <>
          <div className="card">
            <h2>Backup total</h2>
            <p className="muted">
              Exporta o restaura todo tu progreso local (rutinas, entrenamientos, ejercicios custom y
              planificación).
            </p>
            <div className="field">
              <button
                className="ghost-button"
                type="button"
                onClick={handleExportFullBackup}
                disabled={fullBackupExporting}
              >
                {fullBackupExporting ? 'Exportando...' : 'Exportar backup total'}
              </button>
            </div>
            <div className="field">
              <span className="label">Importar backup total (3 pasos)</span>
              {fullBackupStep === 1 ? (
                <label className="ghost-button" htmlFor="full-backup-import">
                  {fullBackupImporting ? 'Validando archivo...' : '1) Seleccionar archivo'}
                </label>
              ) : null}
              {fullBackupStep === 2 && fullBackupPreviewData ? (
                <div className="actions-stack">
                  <p className="muted">
                    2) Revisa el contenido y elige cómo aplicar el backup.
                  </p>
                  <div className="backup-preview-grid">
                    <span>Rutinas: {fullBackupPreviewData.counts.routines}</span>
                    <span>Entrenamientos: {fullBackupPreviewData.counts.workouts}</span>
                    <span>Ejercicios custom: {fullBackupPreviewData.counts.customExercises}</span>
                    <span>Planes: {fullBackupPreviewData.counts.plannedSeries}</span>
                  </div>
                  <div className="toggle-group" role="group" aria-label="Modo de importación">
                    <button
                      type="button"
                      className={fullBackupMode === 'merge' ? 'toggle active' : 'toggle'}
                      onClick={() => setFullBackupMode('merge')}
                    >
                      Fusionar
                    </button>
                    <button
                      type="button"
                      className={fullBackupMode === 'replace' ? 'toggle active' : 'toggle'}
                      onClick={() => setFullBackupMode('replace')}
                    >
                      Reemplazar
                    </button>
                  </div>
                  <div className="actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setFullBackupStep(3)}
                    >
                      Continuar
                    </button>
                    <button className="ghost-button" type="button" onClick={resetFullBackupFlow}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
              {fullBackupStep === 3 && fullBackupPreviewData ? (
                <div className="actions-stack">
                  <p className="muted">
                    3) Confirma la importación en modo{' '}
                    <strong>{fullBackupMode === 'merge' ? 'Fusionar' : 'Reemplazar'}</strong>.
                  </p>
                  {fullBackupMode === 'replace' ? (
                    <label className="actions-stack">
                      <span className="label">Escribe REEMPLAZAR para confirmar</span>
                      <input
                        value={replaceConfirmText}
                        onChange={(event) => setReplaceConfirmText(event.target.value)}
                        placeholder="REEMPLAZAR"
                      />
                    </label>
                  ) : null}
                  <div className="actions">
                    <button
                      className={fullBackupMode === 'replace' ? 'danger-button' : 'ghost-button'}
                      type="button"
                      onClick={handleApplyFullBackup}
                      disabled={
                        fullBackupImporting ||
                        (fullBackupMode === 'replace' && replaceConfirmText.trim() !== 'REEMPLAZAR')
                      }
                    >
                      {fullBackupImporting ? 'Importando...' : 'Importar backup'}
                    </button>
                    <button className="ghost-button" type="button" onClick={() => setFullBackupStep(2)}>
                      Volver
                    </button>
                  </div>
                </div>
              ) : null}
              <input
                id="full-backup-import"
                type="file"
                accept="application/json"
                onChange={handleSelectFullBackupFile}
                style={{ display: 'none' }}
                disabled={fullBackupImporting}
              />
              {fullBackupError ? <p className="warning">{fullBackupError}</p> : null}
            </div>
            {fullBackupResult ? (
              <details className="backup-result">
                <summary>
                  Última importación · importados {fullBackupResult.totals.imported} · fusionados{' '}
                  {fullBackupResult.totals.merged} · omitidos {fullBackupResult.totals.skipped} ·
                  renombrados {fullBackupResult.totals.renamed}
                </summary>
                <div className="actions-stack">
                  <div className="backup-preview-grid">
                    <span>
                      Rutinas: +{fullBackupResult.sections.routines.imported} / ~
                      {fullBackupResult.sections.routines.merged}
                    </span>
                    <span>
                      Entrenos: +{fullBackupResult.sections.workouts.imported} / ~
                      {fullBackupResult.sections.workouts.merged}
                    </span>
                    <span>
                      Ejercicios custom: +{fullBackupResult.sections.customExercises.imported} / ~
                      {fullBackupResult.sections.customExercises.merged}
                    </span>
                    <span>
                      Planes: +{fullBackupResult.sections.plannedSeries.imported} / ~
                      {fullBackupResult.sections.plannedSeries.merged}
                    </span>
                  </div>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={handleDownloadAutoBackup}
                    disabled={downloadingAutoBackup}
                  >
                    {downloadingAutoBackup ? 'Preparando...' : 'Descargar auto-backup previo'}
                  </button>
                </div>
              </details>
            ) : null}
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
        </>
      ) : null}

      {activeSection === 'integrations' ? (
        <div className="card">
          <h2>Integraciones</h2>
          <p className="muted">
            Tips de wrkout usan backend por defecto. Este campo queda como fallback legacy.
          </p>
          <div className="field">
            <label className="label" htmlFor="wrkout-key">
              Wrkout API Key (legacy)
            </label>
            <input
              id="wrkout-key"
              type="password"
              placeholder="Ingresa tu API key"
              value={wrkoutKey}
              onChange={(event) => setWrkoutKey(event.target.value)}
            />
            <button className="ghost-button" type="button" onClick={handleWrkoutSave}>
              Guardar
            </button>
          </div>
        </div>
      ) : null}

      {activeSection === 'maintenance' ? (
        <>
          <div className="card">
            <h2>App (PWA)</h2>
            <p className="muted">
              Si ves una versión anterior, fuerza actualización y limpieza de caché.
            </p>
            <div className="actions-stack">
              <button
                className="ghost-button"
                type="button"
                onClick={handleRefreshPwa}
                disabled={pwaRefreshing}
              >
                {pwaRefreshing ? 'Actualizando...' : 'Actualizar app y limpiar caché'}
              </button>
              <p className="muted">
                Esto no borra rutinas ni entrenamientos: solo refresca archivos de la app.
              </p>
              {pwaStatusMessage ? <p className="muted">{pwaStatusMessage}</p> : null}
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
        </>
      ) : null}

      {activeSection === 'credits' ? (
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
      ) : null}
    </section>
  );
}
