import { create } from 'zustand';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  effectiveTheme: 'light' | 'dark';
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const storedMode = localStorage.getItem('theme') as ThemeMode | null;
  const initialMode: ThemeMode = storedMode || 'system';
  const initialEffective = getEffectiveTheme(initialMode);

  applyTheme(initialEffective);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = get();
    if (state.mode === 'system') {
      const newEffective = getSystemTheme();
      applyTheme(newEffective);
      set({ effectiveTheme: newEffective });
    }
  });

  return {
    mode: initialMode,
    effectiveTheme: initialEffective,
    setMode: (mode: ThemeMode) => {
      localStorage.setItem('theme', mode);
      const effective = getEffectiveTheme(mode);
      applyTheme(effective);
      set({ mode, effectiveTheme: effective });
    },
  };
});
