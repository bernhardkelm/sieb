import { describe, expect, it } from 'vitest'

import { panelClipOf } from '@/components/list/panelClip'

describe('panelClipOf', () => {
  it('pads a cell by the width the panel covers from its end', () => {
    expect(panelClipOf({ left: 300, right: 900 }, 800)).toBe(100)
    expect(panelClipOf({ left: 300, right: 900.4 }, 800)).toBe(101)
  })

  it('leaves a cell left of the panel alone and caps a covered one at its width', () => {
    expect(panelClipOf({ left: 300, right: 700 }, 800)).toBe(0)
    expect(panelClipOf({ left: 900, right: 1000 }, 800)).toBe(100)
  })
})
