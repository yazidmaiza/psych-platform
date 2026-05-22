import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'pp_theme';

const applyThemeToDom = (theme) => {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');
  const [shouldPersistTheme, setShouldPersistTheme] = useState(false);

  const setTheme = useCallback((nextTheme) => {
    setShouldPersistTheme(true);
    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
        setShouldPersistTheme(true);
        applyThemeToDom(saved);
        return;
      }
    } catch {
      // ignore
    }
    applyThemeToDom('light');
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
    try {
      if (shouldPersistTheme) localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme, shouldPersistTheme]);

  const toggleTheme = useCallback(() => {
    setShouldPersistTheme(true);
    setThemeState((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
