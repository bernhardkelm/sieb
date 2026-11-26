import { afterEach, describe, expect, it } from 'vitest'

import { stickyInsets } from '@/components/layout/stickyInsets'

/**
 * Adds a bar marked with a sticky edge, jsdom has no layout so its rect is stubbed.
 * @param {string} edge - Edge attribute value
 * @param {string} style - Inline style with position and offsets
 * @param {number} height - Height in px
 * @returns {HTMLElement} - Bar element
 */
const bar = (edge: string, style: string, height: number): HTMLElement => {
  const element = document.createElement('div')

  element.setAttribute('data-sticky-edge', edge)
  element.setAttribute('style', style)
  element.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 0, height })
  document.body.append(element)
  return element
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('stickyInsets', () => {
  it('covers the top down to the lowest stuck bar, offset plus height', () => {
    bar('top', 'position: sticky; top: 0px', 44)
    bar('top', 'position: sticky; top: 44px', 45)

    expect(stickyInsets()).toEqual({ top: 89, bottom: 0 })
  })

  it('covers the bottom up to the highest stuck bar, a selection bar above the navigation', () => {
    bar('bottom', 'position: fixed; bottom: 0px', 57)
    bar('bottom', 'position: sticky; bottom: 57px', 110)

    expect(stickyInsets()).toEqual({ top: 0, bottom: 167 })
  })

  it('leaves out bars that scroll with the page or have no offset on their edge', () => {
    bar('top', 'position: static; top: 44px', 45)
    bar('bottom', 'position: sticky; top: 0px', 900)

    expect(stickyInsets()).toEqual({ top: 0, bottom: 0 })
  })
})
