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

  it('leaves out the actions row without actions', () => {
    const wrapper = mount(AllClear, { props: { title: 'All clear' } })

    expect(wrapper.find('.actions').exists()).toBe(false)
  })
})
