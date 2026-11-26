import { describe, expect, it } from 'vitest'

import { panelSpans } from '@/components/overview/panelSpans'

/**
 * Builds panels from a pattern of primary (p) and secondary (s) panels.
 * @param {string} pattern - One letter per panel
 * @returns {{ primary: boolean }[]} - Panels in display order
 */
const panels = (pattern: string): { primary: boolean }[] =>
  [...pattern].map((letter) => ({ primary: letter === 'p' }))

describe('panelSpans', () => {
  it('spans the last panel of an odd count across both columns', () => {
    const spans = panelSpans(panels('ppppsss'))

    expect(spans.map((span) => span.wide)).toEqual([false, false, false, false, false, false, true])
    expect(spans.some((span) => span.wideWhenShort)).toBe(false)
  })

  it('spans the last primary panel while the short sidebar keeps an odd count', () => {
    const spans = panelSpans(panels('pppss'))

    expect(spans.map((span) => span.wide)).toEqual([false, false, false, false, true])
    expect(spans.map((span) => span.wideWhenShort)).toEqual([false, false, true, false, false])
  })

  it('spans nothing for an even count', () => {
    expect(panelSpans(panels('ppppss')).some((span) => span.wide || span.wideWhenShort)).toBe(false)
  })
})
