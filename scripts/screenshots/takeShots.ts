import { join } from 'node:path'

import type { PageDriver } from '#scripts/screenshots/chrome/pageDriver.ts'
import type { Theme, Viewport } from '#scripts/screenshots/chrome/pageEmulation.ts'
import type { SeededState } from '#scripts/screenshots/seed/seedState.ts'

export type ViewportName = 'desktop' | 'phone'

export interface Shot {
  name: string
  viewport: ViewportName
  path: (seed: SeededState) => string
  prepare?: (page: PageDriver) => Promise<void> // puts the view into its state after navigation
  clip?: string // selector of the element to crop to, the whole viewport otherwise
}

export const VIEWPORTS: Readonly<Record<ViewportName, Viewport>> = {
  desktop: { width: 1440, height: 900, scale: 2, mobile: false },
  phone: { width: 390, height: 844, scale: 3, mobile: true },
}

const THEMES: readonly Theme[] = ['light', 'dark']

export interface ShotRun {
  page: PageDriver
  baseUrl: string
  seed: SeededState
  outDir: string
}

/**
 * Takes every shot in light and dark, one theme after the other on the same route, and writes
 * screenshot-<name>-<theme>.png files. Shots run in list order, so shots that change state on
 * the server, such as the seen mark of an opened finding, belong at the end.
 * @param {ShotRun} run - Page, sieb URL, seeded ids and output directory
 * @param {readonly Shot[]} shots - Shots to take
 * @returns {Promise<string[]>} - Written files
 */
export const takeShots = async (
  { page, baseUrl, seed, outDir }: ShotRun,
  shots: readonly Shot[],
): Promise<string[]> => {
  const written: string[] = []

  for (const shot of shots) {
    for (const theme of THEMES) {
      const file = join(outDir, `screenshot-${shot.name}-${theme}.png`)

      await page.configure(VIEWPORTS[shot.viewport], theme)
      await page.open('about:blank')
      await page.open(`${baseUrl}${shot.path(seed)}`)
      await shot.prepare?.(page)
      await page.settle()
      await page.capture(file, shot.clip)
      written.push(file)
      console.log(`[sieb] wrote ${file}`)
    }
  }

  return written
}
