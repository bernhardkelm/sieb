import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useTheme } from '@/composables/useTheme'

/**
 * Returns the content of the theme-color meta for one colour scheme.
 * @param {string} scheme - light or dark
 * @returns {string | undefined} - Meta content
 */
const themeColor = (scheme: string): string | undefined =>
  document.head.querySelector<HTMLMetaElement>(`meta[media="(prefers-color-scheme: ${scheme})"]`)
    ?.content

/**
 * Returns the href attribute of the SVG favicon link.
 * @returns {string | null | undefined} - Favicon path
 */
const svgFavicon = (): string | null | undefined =>
  document.head.querySelector('link[type="image/svg+xml"]')?.getAttribute('href')

beforeEach(() => {
  document.head.innerHTML = `
    <meta name="theme-color" content="#fafbfb" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#151618" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />`
})

afterEach(() => {
  useTheme().setTheme('auto')
  document.head.innerHTML = ''
})

describe('useTheme', () => {
  it('puts the colour and favicon of a manual choice on the document head', () => {
    useTheme().setTheme('dark')

    expect([themeColor('light'), themeColor('dark')]).toEqual(['#151618', '#151618'])
    expect(svgFavicon()).toBe('/favicon-dark.svg')

    useTheme().setTheme('light')

    expect([themeColor('light'), themeColor('dark')]).toEqual(['#fafbfb', '#fafbfb'])
    expect(svgFavicon()).toBe('/favicon-light.svg')
  })

  it('restores the colour per scheme and the adaptive favicon for the system choice', () => {
    useTheme().setTheme('dark')
    useTheme().setTheme('auto')

    expect([themeColor('light'), themeColor('dark')]).toEqual(['#fafbfb', '#151618'])
    expect(svgFavicon()).toBe('/favicon.svg')
  })
})
