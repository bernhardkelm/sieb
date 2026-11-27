import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetailResponse } from '#core/apiTypes.ts'
import { mountWithRouter } from '@/__tests__/mountWithRouter'
import { fetchFindingDetail } from '@/api/findingsApi'
import FindingPanel from '@/components/finding/FindingPanel.vue'

vi.mock('@/api/findingsApi', () => ({
  fetchFindingDetail: vi.fn<(id: number) => Promise<FindingDetailResponse>>(),
}))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('FindingPanel Save bar', () => {
  it('puts the sticky Save bar after the Decision section, still submitting its form', async () => {
    vi.mocked(fetchFindingDetail).mockResolvedValue({
      finding: buildFindingView({ id: 1 }),
      instances: [],
      decisions: [],
      events: [],
      kev: null,
      sourceAccess: 'public',
    })
    const { wrapper } = await mountWithRouter(FindingPanel, '/triage?finding=1')

    await flushPromises()

    const form = wrapper.get('form').element as HTMLFormElement
    const bar = wrapper.get('.actions.sticky').element
    const save = [...bar.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Save decision',
    )!
    const section = wrapper.get('[aria-labelledby="panel-decision"]').element

    expect(form.contains(bar)).toBe(false)
    expect(bar.parentElement?.classList).toContain('decision-actions')
    expect(section.nextElementSibling).toBe(bar.parentElement)
    expect(save.type).toBe('submit')
    expect(save.form).toBe(form)
  })
})
