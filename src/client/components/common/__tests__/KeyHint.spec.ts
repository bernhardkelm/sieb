import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import KeyHint from '@/components/common/KeyHint.vue'
import SearchInput from '@/components/filters/SearchInput.vue'

describe('KeyHint', () => {
  it('stays readable as a shortcut legend by default', () => {
    const wrapper = mount(KeyHint, { props: { keys: ['⇧', 'A'] } })

    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
    expect(wrapper.findAll('kbd').map((key) => key.text())).toEqual(['⇧', 'A'])
  })

  it('hides decorative keys inside the search label, the input names the shortcut', () => {
    const wrapper = mount(SearchInput, { props: { modelValue: '', placeholder: 'Search' } })

    expect(wrapper.get('.key-hint').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('input').attributes('aria-keyshortcuts')).toBe('/')
  })
})
