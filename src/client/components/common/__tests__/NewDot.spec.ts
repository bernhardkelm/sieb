import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import NewDot from '@/components/common/NewDot.vue'
import { formatAbsolute } from '@/format/relativeTime'

const FIRST_SEEN = '2026-11-25T08:00:00.000Z'

describe('NewDot', () => {
  it('names the mark for screen readers and hides the dot itself', () => {
    const wrapper = mount(NewDot, { props: { since: FIRST_SEEN } })

    expect(wrapper.get('.visually-hidden').text()).toBe('New')
    expect(wrapper.get('.dot').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toBe('New')
  })

  it('hints the first sighting, or that the item was not seen yet', () => {
    expect(mount(NewDot, { props: { since: FIRST_SEEN } }).attributes('title')).toBe(
      `New since ${formatAbsolute(FIRST_SEEN)}`,
    )
    expect(mount(NewDot).attributes('title')).toBe('Not seen yet')
  })
})
