import { db, SettingsRecord } from './db';
import { applyTheme, Theme } from '../theme/theme';

export const SETTINGS_CHANGE_EVENT = 'settings-changed';

function detectTimezone() {
  if (typeof Intl === 'undefined') return 'UTC';
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export const defaultSettings: SettingsRecord = {
  id: 'app',
  theme: 'dark',
  language: 'es',
  units: 'kg',
  statsRangeDays: 30,
  wrkoutApiKey: '',
  notificationSettingsUpdatedAt: '1970-01-01T00:00:00.000Z',
  notificationTimezone: 'UTC',
  notificationsEnabled: false,
  plannedWorkoutNotificationsEnabled: false,
  restFinishedNotificationsEnabled: true,
  backgroundSessionNotificationsEnabled: false,
  plannedReminderTime: '19:00',
  plannedReminderOffsetMinutes: 0,
  backgroundSessionReminderDelayMinutes: 10
};

export async function loadSettings(): Promise<SettingsRecord> {
  const stored = await db.settings.get('app');
  if (stored) {
    const next = {
      ...defaultSettings,
      ...stored,
      notificationTimezone: stored.notificationTimezone ?? detectTimezone()
    };
    if (next.notificationTimezone !== stored.notificationTimezone) {
      await db.settings.put(next);
    }
    return next;
  }
  const next = { ...defaultSettings, notificationTimezone: detectTimezone() };
  await db.settings.put(next);
  return next;
}

export async function saveSettings(settings: SettingsRecord) {
  await db.settings.put(settings);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT));
  }
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
}
