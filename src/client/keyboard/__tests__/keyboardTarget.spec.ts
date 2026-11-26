import { describe, expect, it } from 'vitest'

import { isEditableTarget, isShortcutEvent, shortcutScope } from '@/keyboard/keyboardTarget'

/**
 * Dispatches a keydown on an element and returns the event.
 * @param {HTMLElement} element - Target element
 * @param {KeyboardEventInit} init - Event options
 * @returns {KeyboardEvent} - Dispatched event
 */
const keydownOn = (element: HTMLElement, init: KeyboardEventInit): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { bubbles: true, ...init })

  element.dispatchEvent(event)
  return event
}

describe('keyboard targets', () => {
  it('treats inputs and contenteditable as editable', () => {
    const editable = document.createElement('div')

    editable.contentEditable = 'true'
    expect(isEditableTarget(document.createElement('input'))).toBe(true)
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableTarget(document.createElement('button'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })

  it('allows plain keys and rejects modifiers and text entries', () => {
    const button = document.createElement('button')
    const input = document.createElement('input')

    expect(isShortcutEvent(keydownOn(button, { key: '1' }))).toBe(true)
    expect(isShortcutEvent(keydownOn(button, { key: '1', metaKey: true }))).toBe(false)
    expect(isShortcutEvent(keydownOn(input, { key: '1' }))).toBe(false)
  })

  it('treats dialogs, menus and marked overlays as overlay scope', () => {
    const page = document.createElement('button')
    const menu = document.createElement('div')
    const item = document.createElement('div')
    const panel = document.createElement('aside')
    const inPanel = document.createElement('button')

    menu.setAttribute('role', 'menu')
    menu.append(item)
    panel.setAttribute('data-shortcut-scope', 'panel')
    panel.append(inPanel)

    expect(shortcutScope(page)).toBe('page')
    expect(shortcutScope(item)).toBe('overlay')
    expect(shortcutScope(inPanel)).toBe('panel')
    expect(shortcutScope(null)).toBe('page')
  })
})
