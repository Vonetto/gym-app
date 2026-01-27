const THEME_KEY = 'gym-theme';

export type Theme = 'dark' | 'light';

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}
