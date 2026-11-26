import { afterEach, describe, expect, it } from 'vitest'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import DecisionStateChip from '@/components/chips/DecisionStateChip.vue'
import FindingRow from '@/components/finding/FindingRow.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('FindingRow', () => {
  it('passes the justification of the governing decision to the decision chip', () => {
    const decision = buildDecision({ justification: 'vulnerable_code_not_present' })
    const wrapper = mountWithProviders(FindingRow, {
      finding: buildFindingView({ decision, effective: { state: 'active' } }),
      current: false,
      checked: false,
      isNew: false,
      showDecision: true,
    })

    expect(wrapper.getComponent(DecisionStateChip).props('justification')).toBe(
      'vulnerable_code_not_present',
    )
  })

  it('passes no justification for an undecided row or a decision without one', () => {
    const decision = buildDecision({ status: 'accepted', justification: null })
    const wrapper = mountWithProviders(FindingRow, {
      finding: buildFindingView({ decision, effective: { state: 'active' } }),
      current: false,
      checked: false,
      isNew: false,
      showDecision: true,
    })

    expect(wrapper.getComponent(DecisionStateChip).props('justification')).toBeNull()
  })
})
