import { describe, expect, it } from 'vitest'

import { cursorActionFor, isRepeatableKey, isSelectAllEvent } from '@/keyboard/cursorKeymap'
import { rowClickIntent } from '@/keyboard/rowClick'

const press = (key: string, shiftKey = false) => ({ key, shiftKey })

/**
 * Builds a keydown event on a target.
 * @param {KeyboardEventInit} init - Event fields
 * @param {Element} target - Target the event is dispatched on
 * @returns {KeyboardEvent} - Dispatched event
 */
const keydownOn = (init: KeyboardEventInit, target: Element = document.body): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true })

  target.dispatchEvent(event)
  return event
}

describe('cursorActionFor', () => {
  it('moves by row, page and to the ends', () => {
    expect(cursorActionFor(press('j'), 'page', false)).toEqual({
      kind: 'move',
      step: 'next',
      extend: false,
    })
    expect(cursorActionFor(press('ArrowUp'), 'page', true)).toMatchObject({ step: 'previous' })
    expect(cursorActionFor(press('PageDown'), 'page', true)).toMatchObject({ step: 'pageNext' })
    expect(cursorActionFor(press('PageUp'), 'page', true)).toMatchObject({ step: 'pagePrevious' })
    expect(cursorActionFor(press('Home'), 'page', true)).toMatchObject({ step: 'first' })
    expect(cursorActionFor(press('End'), 'page', true)).toMatchObject({ step: 'last' })
  })

  it('extends with Shift only in lists with multiple selection', () => {
    expect(cursorActionFor(press('ArrowDown', true), 'page', true)).toMatchObject({ extend: true })
    expect(cursorActionFor(press('J', true), 'page', true)).toMatchObject({
      step: 'next',
      extend: true,
    })
    expect(cursorActionFor(press('End', true), 'page', true)).toMatchObject({ extend: true })
    expect(cursorActionFor(press('ArrowDown', true), 'page', false)).toMatchObject({
      extend: false,
    })
  })

  it('toggles with Space or x and clears with Escape in lists with multiple selection', () => {
    expect(cursorActionFor(press(' '), 'page', true)).toEqual({ kind: 'toggle' })
    expect(cursorActionFor(press('x'), 'page', true)).toEqual({ kind: 'toggle' })
    expect(cursorActionFor(press('Escape'), 'page', true)).toEqual({ kind: 'clear' })
    expect(cursorActionFor(press(' '), 'page', false)).toBeNull()
    expect(cursorActionFor(press('Escape'), 'page', false)).toBeNull()
  })

  it('keeps only j and k inside the panel and nothing in overlays', () => {
    expect(cursorActionFor(press('k'), 'panel', true)).toMatchObject({ step: 'previous' })
    expect(cursorActionFor(press('ArrowDown'), 'panel', true)).toBeNull()
    expect(cursorActionFor(press('Home'), 'panel', true)).toBeNull()
    expect(cursorActionFor(press(' '), 'panel', true)).toBeNull()
    expect(cursorActionFor(press('j'), 'overlay', true)).toBeNull()
  })

  it('repeats only the row and page moves', () => {
    expect(isRepeatableKey('ArrowDown')).toBe(true)
    expect(isRepeatableKey('PageUp')).toBe(true)
    expect(isRepeatableKey('Home')).toBe(false)
    expect(isRepeatableKey('x')).toBe(false)
  })
})

describe('isSelectAllEvent', () => {
  it('takes Cmd+A on Apple platforms and Ctrl+A elsewhere', () => {
    expect(isSelectAllEvent(keydownOn({ key: 'a', metaKey: true }), true)).toBe(true)
    expect(isSelectAllEvent(keydownOn({ key: 'a', ctrlKey: true }), true)).toBe(false)
    expect(isSelectAllEvent(keydownOn({ key: 'a', ctrlKey: true }), false)).toBe(true)
    expect(isSelectAllEvent(keydownOn({ key: 'a' }), false)).toBe(false)
    expect(isSelectAllEvent(keydownOn({ key: 'A', ctrlKey: true, shiftKey: true }), false)).toBe(
      false,
    )
  })

  it('leaves the chord to text entries', () => {
    const input = document.body.appendChild(document.createElement('input'))

    expect(isSelectAllEvent(keydownOn({ key: 'a', ctrlKey: true }, input), false)).toBe(false)
    input.remove()
  })
})

describe('rowClickIntent', () => {
  const click = (init: Partial<MouseEvent> = {}) => ({
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    ...init,
  })

  it('ranges with Shift and toggles with the command modifier of the platform', () => {
    expect(rowClickIntent(click({ shiftKey: true }), true, true)).toBe('range')
    expect(rowClickIntent(click({ metaKey: true }), true, true)).toBe('toggle')
    expect(rowClickIntent(click({ ctrlKey: true }), true, true)).toBe('open')
    expect(rowClickIntent(click({ ctrlKey: true }), true, false)).toBe('toggle')
    expect(rowClickIntent(click(), true, true)).toBe('open')
  })

  it('opens every click in lists without multiple selection', () => {
    expect(rowClickIntent(click({ shiftKey: true }), false, true)).toBe('open')
    expect(rowClickIntent(undefined, true, true)).toBe('open')
  })
})
