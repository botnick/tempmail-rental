'use client';

/**
 * Dark Mode (Theme) Toggle Component
 *
 * Toggles between dark and light themes.
 * Persists preference in localStorage.
 * The app defaults to dark mode.
 */

import { Moon, Sun } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'theme-preference';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light') {
      setIsDark(false);
      document.documentElement.classList.add('light-mode');
    }
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.remove('light-mode');
        localStorage.setItem(STORAGE_KEY, 'dark');
      } else {
        document.documentElement.classList.add('light-mode');
        localStorage.setItem(STORAGE_KEY, 'light');
      }
      return next;
    });
  }, []);

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-xl border border-border-subtle bg-white/[0.03] hover:bg-white/[0.08] transition-all duration-200 cursor-pointer"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-400" />
      )}
    </button>
  );
}
