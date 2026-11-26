import { afterEach, describe, expect, it } from 'vitest'

import { buildDecision } from '#core/__tests__/coreBuilders.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import DecisionDetail from '@/components/decisions/DecisionDetail.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DecisionDetail', () => {
  it('shows the justification above the reason', () => {
    const wrapper = mountWithProviders(DecisionDetail, {
      view: {
        decision: buildDecision({ justification: 'inline_mitigations_already_exist' }),
        effective: { state: 'active' },
        openFindings: 1,
      },
      findingCount: 1,
    })

    expect(wrapper.get('.justification').text()).toBe('Justification: Mitigated')
    expect(wrapper.get('.justification + .reason').text()).toBe('not reachable')
  })
})
