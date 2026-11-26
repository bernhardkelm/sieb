import { readonly, ref, type Ref } from 'vue'

export type ThemeChoice = 'auto' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'sieb-theme'

/**
 * Reads the stored theme choice, falling back to auto when storage is empty or blocked.
 * @returns {ThemeChoice} - Stored choice
 */
export const readStoredTheme = (): ThemeChoice => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

/**
 * Applies a theme choice to the html element; auto removes data-theme so the system decides.
 * @param {ThemeChoice} choice - Theme choice
 * @returns {void}
 */
export const applyTheme = (choice: ThemeChoice): void => {
  if (choice === 'auto') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', choice)
  }
}

const theme = ref<ThemeChoice>(readStoredTheme())

/**
 * Shares the theme choice across components, applies it to the document and remembers it in
 * localStorage.
 * @returns {{ theme: Readonly<Ref<ThemeChoice>>, setTheme: (choice: ThemeChoice) => void }} - Choice and setter
 */
export const useTheme = (): {
  theme: Readonly<Ref<ThemeChoice>>
  setTheme: (choice: ThemeChoice) => void
} => {
  /**
   * Selects, applies and stores a theme.
   * @param {ThemeChoice} choice - Theme choice
   * @returns {void}
   */
  const setTheme = (choice: ThemeChoice): void => {
    theme.value = choice
    applyTheme(choice)

    try {
      if (choice === 'auto') {
        localStorage.removeItem(THEME_STORAGE_KEY)
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, choice)
      }
    } catch {
      // storage blocked, the choice still applies for this page view
    }
  }

  return { theme: readonly(theme), setTheme }
}
