import { describe, expect, it, vi } from 'vitest'

import { createHold } from '@/stores/hold'

describe('createHold', () => {
  it('runs onFirst with the first hold and onLast with the last release', () => {
    const onFirst = vi.fn<() => void>()
    const onLast = vi.fn<() => void>()
    const hold = createHold(onFirst, onLast)

    const releaseFirst = hold.take()
    const releaseSecond = hold.take()

    expect(onFirst).toHaveBeenCalledOnce()
    expect(hold.held()).toBe(true)

    releaseFirst()
    expect(onLast).not.toHaveBeenCalled()

    releaseSecond()
    expect(onLast).toHaveBeenCalledOnce()
    expect(hold.held()).toBe(false)
  })

  it('counts a release twice only once', () => {
    const onLast = vi.fn<() => void>()
    const hold = createHold(undefined, onLast)
    const releaseFirst = hold.take()

    hold.take()
    releaseFirst()
    releaseFirst()

    expect(onLast).not.toHaveBeenCalled()
    expect(hold.held()).toBe(true)
  })

  it('starts again after the last release', () => {
    const onFirst = vi.fn<() => void>()
    const hold = createHold(onFirst)

    hold.take()()
    hold.take()

    expect(onFirst).toHaveBeenCalledTimes(2)
  })
})
