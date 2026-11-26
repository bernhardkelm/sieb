import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ReferenceLinks from '@/components/proposals/ReferenceLinks.vue'

describe('ReferenceLinks', () => {
  it('links and shows the normalized URL, a lookalike host in punycode', () => {
    const wrapper = mount(ReferenceLinks, {
      props: { references: ['https://nvd.nіst.gov/x', 'javascript:alert(1)'] },
    })
    const links = wrapper.findAll('a')

    expect(links).toHaveLength(1)
    expect(links[0]!.attributes('href')).toBe('https://nvd.xn--nst-jhd.gov/x')
    expect(links[0]!.text()).toBe('https://nvd.xn--nst-jhd.gov/x ↗')
  })
})
