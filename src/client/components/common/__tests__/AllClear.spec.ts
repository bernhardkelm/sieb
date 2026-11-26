import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import AllClear from '@/components/common/AllClear.vue'

describe('AllClear', () => {
  it('renders the heading, text and actions with a decorative illustration', () => {
    const wrapper = mount(AllClear, {
      props: { title: 'All clear' },
      slots: {
        default: () => 'Nothing is waiting for you.',
        actions: () => h('a', { href: '/decisions' }, 'Review decisions'),
      },
    })

    expect(wrapper.get('h2').text()).toBe('All clear')
    expect(wrapper.get('p').text()).toBe('Nothing is waiting for you.')
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.actions a').text()).toBe('Review decisions')
  })

  it('renders a slotted illustration in place of the smiley', () => {
    const wrapper = mount(AllClear, {
      props: { title: 'Inbox zero' },
      slots: { illustration: () => h('svg', { class: 'custom', 'aria-hidden': 'true' }) },
    })

    expect(wrapper.find('.custom').exists()).toBe(true)
    expect(wrapper.find('.smile').exists()).toBe(false)
  })

  it('renders the smiley by default', () => {
    const wrapper = mount(AllClear, { props: { title: 'All clear' } })

    expect(wrapper.find('.smile').exists()).toBe(true)
  })

  it('leaves out the actions row without actions', () => {
    const wrapper = mount(AllClear, { props: { title: 'All clear' } })

    expect(wrapper.find('.actions').exists()).toBe(false)
  })
})
