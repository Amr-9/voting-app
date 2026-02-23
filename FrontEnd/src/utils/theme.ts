export type Theme = 'dark' | 'light'

export function getTheme(): Theme {
  return (document.documentElement.getAttribute('data-theme') as Theme) ?? 'dark'
}

/**
 * Toggles between 'dark' and 'light'.
 * Writes to localStorage ONLY on explicit user toggle (not on mount).
 */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('theme', next)
  return next
}
