import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import InboxZeroIllustration from '@/components/inbox/InboxZeroIllustration.vue'

describe('InboxZeroIllustration', () => {
  it('draws a decorative empty tray with a check', () => {
    const wrapper = mount(InboxZeroIllustration)

    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('.tray').exists()).toBe(true)
    expect(wrapper.find('.check').exists()).toBe(true)
    expect(wrapper.find('.smile').exists()).toBe(false)
  })
})
