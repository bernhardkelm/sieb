import type { CdpClient } from '#scripts/screenshots/chrome/cdpClient.ts'

export type Theme = 'light' | 'dark'

export interface Viewport {
  width: number
  height: number
  scale: number // device pixel ratio
  mobile: boolean
}

export type ApplyEmulation = (viewport: Viewport, theme: Theme) => Promise<void>

const LOCALE = 'en-US'
const THEME_STORAGE_KEY = 'sieb-theme'

const STILL_STYLE =
  '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'

/** Disables animations and the caret on every document the page loads, so frames are stable */
const STILL_SCRIPT = `document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style')
  style.textContent = ${JSON.stringify(STILL_STYLE)}
  document.head.appendChild(style)
})`

/**
 * Prepares a page for stable frames (no animations, no caret, en-US locale, reduced motion) and
 * returns the function that switches viewport and theme. The theme goes through the app's own
 * stored theme setting and the colour scheme media feature, applied from the next navigation on.
 * @param {CdpClient} page - Page client
 * @returns {Promise<ApplyEmulation>} - Sets viewport and theme
 */
export const createEmulation = async (page: CdpClient): Promise<ApplyEmulation> => {
  let themeScript: string | null = null

  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: STILL_SCRIPT })
  await page.send('Emulation.setLocaleOverride', { locale: LOCALE })

  return async ({ width, height, scale, mobile }, theme) => {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: scale,
      mobile,
    })
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 5 })
    await page.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: theme },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
    })

    if (themeScript !== null) {
      await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: themeScript })
    }

    const key = JSON.stringify(THEME_STORAGE_KEY)
    const source = `try { localStorage.setItem(${key}, ${JSON.stringify(theme)}) } catch {}`
    const added = await page.send<{ identifier: string }>('Page.addScriptToEvaluateOnNewDocument', {
      source,
    })

    themeScript = added.identifier
  }
}
