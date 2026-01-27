import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { defaultSettings, loadSettings, saveSettings, setTheme } from './settings';
import { resetAll } from './db';
import { Theme } from '../theme/theme';

interface SettingsContextValue {
  settings: typeof defaultSettings;
  ready: boolean;
  updateTheme: (theme: Theme) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadSettings().then((loaded) => {
      if (!active) return;
      setSettings(loaded);
      setTheme(loaded.theme);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const updateTheme = async (theme: Theme) => {
    const next = { ...settings, theme };
    setSettings(next);
    setTheme(theme);
    await saveSettings(next);
  };

  const resetAllData = async () => {
    await resetAll();
    await saveSettings(defaultSettings);
    setSettings(defaultSettings);
    setTheme(defaultSettings.theme);
  };

  const value = useMemo(
    () => ({
      settings,
      ready,
      updateTheme,
      resetAllData
    }),
    [settings, ready]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
