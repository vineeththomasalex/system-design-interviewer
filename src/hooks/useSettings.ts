import { useState, useCallback } from 'react';
import type { AppSettings } from '../types/interview';
import { loadSettings, saveSettings } from '../store/settingsStore';

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
