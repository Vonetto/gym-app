import { db, SettingsRecord } from './db';
import { applyTheme, Theme } from '../theme/theme';

export const defaultSettings: SettingsRecord = {
  id: 'app',
  theme: 'dark',
  language: 'es',
  units: 'kg'
};

export async function loadSettings(): Promise<SettingsRecord> {
  const stored = await db.settings.get('app');
  if (stored) {
    return stored;
  }
  await db.settings.put(defaultSettings);
  return defaultSettings;
}

export async function saveSettings(settings: SettingsRecord) {
  await db.settings.put(settings);
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
}
