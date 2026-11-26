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

const FAVICONS: Record<ThemeChoice, string> = {
  auto: '/favicon.svg',
  light: '/favicon-light.svg',
  dark: '/favicon-dark.svg',
}

/**
 * Points the theme-color metas and the SVG favicon at the chosen theme. Each meta keeps its
 * media query and remembers the colour of its own scheme in data-scheme-color, so auto
 * restores the colour per scheme and a manual choice puts the colour of that scheme on all.
 * @param {ThemeChoice} choice - Theme choice
 * @returns {void}
 */
export const applyThemeHead = (choice: ThemeChoice): void => {
  const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]

  for (const meta of metas) {
    meta.dataset.schemeColor ??= meta.content
  }

  const chosen = metas.find((meta) => meta.getAttribute('media')?.includes(choice))?.dataset
    .schemeColor

  for (const meta of metas) {
    meta.content = (choice !== 'auto' && chosen) || meta.dataset.schemeColor || meta.content
  }

  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]')

  if (icon) {
    icon.setAttribute('href', FAVICONS[choice])
  }
}

/**
 * Applies a theme choice to the html element and the document head; auto removes data-theme
 * so the system decides.
 * @param {ThemeChoice} choice - Theme choice
 * @returns {void}
 */
export const applyTheme = (choice: ThemeChoice): void => {
  if (choice === 'auto') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', choice)
  }

  applyThemeHead(choice)
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
