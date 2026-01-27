const THEME_KEY = 'gym-theme';

function resolveTheme(): 'dark' | 'light' {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return 'dark';
}

const theme = resolveTheme();

document.documentElement.dataset.theme = theme;
localStorage.setItem(THEME_KEY, theme);
