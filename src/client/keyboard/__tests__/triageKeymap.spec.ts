import { describe, expect, it } from 'vitest'

import { triageActionFor } from '@/keyboard/triageKeymap'

const press = (key: string, shiftKey = false) => ({ key, shiftKey })

describe('triageActionFor', () => {
  it('maps the triage keys on the page and leaves the cursor keys to the shared keymap', () => {
    expect(triageActionFor(press('Enter'), 'page')).toBe('open')
    expect(triageActionFor(press('o'), 'page')).toBe('open')
    expect(triageActionFor(press('Escape'), 'page')).toBe('close')
    expect(triageActionFor(press('/'), 'page')).toBe('search')
    expect(triageActionFor(press('j'), 'page')).toBeNull()
    expect(triageActionFor(press('x'), 'page')).toBeNull()
  })

  it('maps the decision keys', () => {
    expect(triageActionFor(press('a'), 'page')).toBe('accept')
    expect(triageActionFor(press('n'), 'page')).toBe('notAffected')
    expect(triageActionFor(press('f'), 'page')).toBe('fixPlanned')
  })

  it('needs Shift for the bulk decision', () => {
    expect(triageActionFor(press('A', true), 'page')).toBe('bulk')
    expect(triageActionFor(press('A'), 'page')).toBeNull()
  })

  it('leaves Enter, Escape and decision keys to the panel', () => {
    expect(triageActionFor(press('A', true), 'panel')).toBe('bulk')
    expect(triageActionFor(press('/'), 'panel')).toBe('search')
    expect(triageActionFor(press('Enter'), 'panel')).toBeNull()
    expect(triageActionFor(press('Escape'), 'panel')).toBeNull()
    expect(triageActionFor(press('a'), 'panel')).toBeNull()
  })

  it('ignores every key in popovers and dialogs and unknown keys', () => {
    expect(triageActionFor(press('/'), 'overlay')).toBeNull()
    expect(triageActionFor(press('q'), 'page')).toBeNull()
  })
})
