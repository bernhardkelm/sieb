import { describe, expect, it } from 'vitest'

import { inboxActionFor } from '@/keyboard/inboxKeymap'

const press = (key: string, shiftKey = false) => ({ key, shiftKey })

describe('inboxActionFor', () => {
  it('maps the inbox keys on the page and leaves the cursor keys to the shared keymap', () => {
    expect(inboxActionFor(press('Enter'), 'page')).toBe('open')
    expect(inboxActionFor(press('o'), 'page')).toBe('open')
    expect(inboxActionFor(press('Escape'), 'page')).toBe('close')
    expect(inboxActionFor(press('/'), 'page')).toBe('search')
    expect(inboxActionFor(press('j'), 'page')).toBeNull()
    expect(inboxActionFor(press('x'), 'page')).toBeNull()
  })

  it('maps the decision keys', () => {
    expect(inboxActionFor(press('a'), 'page')).toBe('accept')
    expect(inboxActionFor(press('n'), 'page')).toBe('notAffected')
    expect(inboxActionFor(press('f'), 'page')).toBe('fixPlanned')
  })

  it('needs Shift for the bulk decision', () => {
    expect(inboxActionFor(press('A', true), 'page')).toBe('bulk')
    expect(inboxActionFor(press('A'), 'page')).toBeNull()
  })

  it('leaves Enter, Escape and decision keys to the panel', () => {
    expect(inboxActionFor(press('A', true), 'panel')).toBe('bulk')
    expect(inboxActionFor(press('/'), 'panel')).toBe('search')
    expect(inboxActionFor(press('Enter'), 'panel')).toBeNull()
    expect(inboxActionFor(press('Escape'), 'panel')).toBeNull()
    expect(inboxActionFor(press('a'), 'panel')).toBeNull()
  })

  it('ignores every key in popovers and dialogs and unknown keys', () => {
    expect(inboxActionFor(press('/'), 'overlay')).toBeNull()
    expect(inboxActionFor(press('q'), 'page')).toBeNull()
  })
})
