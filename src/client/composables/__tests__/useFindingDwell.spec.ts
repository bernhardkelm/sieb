import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope, type Ref } from 'vue'

import { DWELL_MS, useFindingDwell } from '@/composables/useFindingDwell'

interface DwellProbe {
  shown: Ref<number | null>
  onDwell: Mock<(id: number) => void>
}

let scope: EffectScope | null = null
let visibility: DocumentVisibilityState = 'visible'

/**
 * Starts the dwell timer over a shown finding id.
 * @param {number | null} initial - Finding shown first
 * @returns {DwellProbe} - Shown id and the dwell callback
 */
const startDwell = (initial: number | null): DwellProbe => {
  const shown = ref<number | null>(initial)
  const onDwell = vi.fn<(id: number) => void>()

  scope = effectScope()
  scope.run(() => {
    useFindingDwell(() => shown.value, onDwell)
  })

  return { shown, onDwell }
}

/**
 * Switches the visibility of the tab.
 * @param {DocumentVisibilityState} state - New visibility
 * @returns {void}
 */
const setVisibility = (state: DocumentVisibilityState): void => {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
})

afterEach(() => {
  scope?.stop()
  scope = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useFindingDwell', () => {
  it('reports a finding once it stayed shown for two seconds, and only once', () => {
    const { onDwell } = startDwell(7)

    vi.advanceTimersByTime(DWELL_MS - 1)
    expect(onDwell).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onDwell).toHaveBeenCalledExactlyOnceWith(7)

    vi.advanceTimersByTime(DWELL_MS * 3)
    expect(onDwell).toHaveBeenCalledTimes(1)
  })

  it('restarts the time when the shown finding changes, skimming reports nothing', async () => {
    const { shown, onDwell } = startDwell(1)

    for (const id of [2, 3, 4]) {
      vi.advanceTimersByTime(DWELL_MS - 500)
      shown.value = id
      await nextTick()
    }

    expect(onDwell).not.toHaveBeenCalled()

    vi.advanceTimersByTime(DWELL_MS)
    expect(onDwell).toHaveBeenCalledExactlyOnceWith(4)
  })

  it('waits for nothing while no finding is shown', async () => {
    const { shown, onDwell } = startDwell(1)

    vi.advanceTimersByTime(DWELL_MS - 1)
    shown.value = null
    await nextTick()
    vi.advanceTimersByTime(DWELL_MS * 2)

    expect(onDwell).not.toHaveBeenCalled()
  })

  it('pauses while the tab is hidden and runs on once it shows again', () => {
    const { onDwell } = startDwell(5)

    vi.advanceTimersByTime(1500)
    setVisibility('hidden')
    vi.advanceTimersByTime(DWELL_MS * 5)
    expect(onDwell).not.toHaveBeenCalled()

    setVisibility('visible')
    vi.advanceTimersByTime(499)
    expect(onDwell).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onDwell).toHaveBeenCalledExactlyOnceWith(5)
  })

  it('starts counting only once a hidden tab shows', () => {
    visibility = 'hidden'

    const { onDwell } = startDwell(5)

    vi.advanceTimersByTime(DWELL_MS * 2)
    expect(onDwell).not.toHaveBeenCalled()

    setVisibility('visible')
    vi.advanceTimersByTime(DWELL_MS)
    expect(onDwell).toHaveBeenCalledExactlyOnceWith(5)
  })
})
