import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Ref } from 'vue'

import { createSharedClock } from '@/composables/sharedClock'

const START = new Date('2099-01-01T00:00:00Z')

/**
 * Mounts a component that reads a shared clock.
 * @param {() => Readonly<Ref<Date>>} useClock - Clock composable
 * @returns {{ now: Readonly<Ref<Date>>; unmount: () => void }} - Clock value and unmount
 */
const mountClock = (
  useClock: () => Readonly<Ref<Date>>,
): { now: Readonly<Ref<Date>>; unmount: () => void } => {
  let now: Readonly<Ref<Date>> | undefined
  const wrapper = mount(
    defineComponent({
      setup: () => {
        now = useClock()

        return () => h('span')
      },
    }),
  )

  return { now: now as Readonly<Ref<Date>>, unmount: () => wrapper.unmount() }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createSharedClock', () => {
  it('ticks while used and stops with the last user', () => {
    const useClock = createSharedClock(1_000)
    const first = mountClock(useClock)
    const second = mountClock(useClock)

    vi.advanceTimersByTime(1_000)
    expect(first.now.value.getTime()).toBe(START.getTime() + 1_000)
    expect(second.now.value).toEqual(first.now.value)

    first.unmount()
    vi.advanceTimersByTime(1_000)
    expect(second.now.value.getTime()).toBe(START.getTime() + 2_000)

    second.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sets the time only on the first use by default', () => {
    const useClock = createSharedClock(30_000)
    const first = mountClock(useClock)

    vi.setSystemTime(START.getTime() + 5_000)
    mountClock(useClock)

    expect(first.now.value).toEqual(START)
  })

  it('sets the time on every use with refreshOnUse', () => {
    const useClock = createSharedClock(30_000, { refreshOnUse: true })
    const first = mountClock(useClock)

    vi.setSystemTime(START.getTime() + 5_000)
    mountClock(useClock)

    expect(first.now.value.getTime()).toBe(START.getTime() + 5_000)
  })
})
