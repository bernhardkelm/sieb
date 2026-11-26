import { afterEach, describe, expect, it } from 'vitest'

import { buildDecision } from '#core/__tests__/coreBuilders.ts'
import type { DecisionView } from '#core/findingView.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import { reopenedEffective } from '@/__tests__/reopenedEffective'
import DecisionStateChip from '@/components/chips/DecisionStateChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import DecisionCard from '@/components/decision/DecisionCard.vue'

/**
 * Builds an active decision view.
 * @param {Partial<DecisionView['decision']>} overrides - Decision fields to set
 * @returns {DecisionView} - Decision view
 */
const activeView = (overrides: Partial<DecisionView['decision']> = {}): DecisionView => ({
  decision: buildDecision(overrides),
  effective: { state: 'active' },
  openFindings: 1,
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DecisionCard', () => {
  it('shows the justification as secondary text and in the state tooltip', () => {
    const wrapper = mountWithProviders(DecisionCard, {
      view: activeView({ justification: 'vulnerable_code_cannot_be_controlled_by_adversary' }),
    })

    expect(wrapper.get('.justification').text()).toBe(
      'Justification: Cannot be controlled by an adversary',
    )
    expect(wrapper.getComponent(DecisionStateChip).getComponent(HintTooltip).props('text')).toBe(
      'Not affected, alerts muted. Justification: Cannot be controlled by an adversary',
    )
  })

  it('leaves the justification out when there is none', () => {
    const wrapper = mountWithProviders(DecisionCard, { view: activeView() })

    expect(wrapper.find('.justification').exists()).toBe(false)
    expect(wrapper.getComponent(DecisionStateChip).getComponent(HintTooltip).props('text')).toBe(
      'Not affected, alerts muted',
    )
  })

  it('offers re-confirm for a re-open no sync has latched yet', async () => {
    const wrapper = mountWithProviders(DecisionCard, {
      view: {
        ...activeView({ reopenedAt: null }),
        effective: reopenedEffective({ reopenedAt: null }),
      },
    })
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === 'Re-confirm')

    await button!.trigger('click')

    expect(wrapper.getComponent(DecisionCard).emitted('reconfirm')).toHaveLength(1)
  })
})
