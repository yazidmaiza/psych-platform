import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggleButton({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'light' ? 'Dark' : 'Light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={[
        'rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] hover:brightness-110 transition',
        className
      ].filter(Boolean).join(' ')}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {next} mode
    </button>
  );
}

