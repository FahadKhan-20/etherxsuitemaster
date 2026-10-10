import { useSyncExternalStore } from 'react';

// App-wide colour theme. The choice ('light' | 'dark' | 'system') lives in localStorage; the resolved
// theme is written to <html data-theme>, which switches every colour token in styles/theme-palette.css.
export const THEMES = ['light', 'dark', 'system'];
const KEY = 'nexmeet_theme';
const listeners = new Set();

function readChoice() {
  try {
    const stored = localStorage.getItem(KEY);
    return THEMES.includes(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

const systemQuery = () => (typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: light)') : null);
export const resolveTheme = (choice) => (choice === 'system' ? (systemQuery()?.matches ? 'light' : 'dark') : choice);

export function applyTheme(choice = readChoice()) {
  const resolved = resolveTheme(choice);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

const notify = () => listeners.forEach((listener) => listener());

export function setTheme(choice) {
  if (!THEMES.includes(choice)) return;
  try { localStorage.setItem(KEY, choice); } catch { /* private mode: theme still applies for this page */ }
  applyTheme(choice);
  notify();
}

systemQuery()?.addEventListener?.('change', () => {
  if (readChoice() === 'system') { applyTheme('system'); notify(); }
});

const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
const snapshot = () => `${readChoice()}:${resolveTheme(readChoice())}`;

/** Current theme choice, the theme actually shown, and a setter. */
export function useTheme() {
  const [theme, resolved] = useSyncExternalStore(subscribe, snapshot, () => 'dark:dark').split(':');
  return { theme, resolved, setTheme };
}
