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

  it('marks a new row with the dot instead of the word', () => {
    const wrapper = mountWithProviders(FindingRow, {
      finding: buildFindingView({ firstSeen: '2026-11-25T08:00:00.000Z' }),
      current: false,
      checked: false,
      isNew: true,
    })
    const title = wrapper.get('.title')

    expect(title.find('.new-dot').exists()).toBe(true)
    expect(title.get('.new-dot .visually-hidden').text()).toBe('New')
    expect(title.text()).not.toMatch(/\bnew\b/)
  })

  it('leaves a row without the dot when it is not new', () => {
    const wrapper = mountWithProviders(FindingRow, {
      finding: buildFindingView(),
      current: false,
      checked: false,
      isNew: false,
    })

    expect(wrapper.find('.new-dot').exists()).toBe(false)
  })
})
