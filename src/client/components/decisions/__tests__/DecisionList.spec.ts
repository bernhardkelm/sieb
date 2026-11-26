import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDecision, buildFindingView, NOW } from '#core/__tests__/coreBuilders.ts'
import type { DecisionView } from '#core/findingView.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import DecisionList from '@/components/decisions/DecisionList.vue'

const REOPENED: DecisionView = {
  decision: buildDecision({ id: 1, severityAtDecision: 'High', reason: 'ingress terminates TLS' }),
  effective: {
    state: 'reopened',
    reopenedAt: '2026-05-31T00:00:00.000Z',
    reason: 'severity_rose',
    imageRef: 'index.docker.io/library/redis',
    severity: 'Critical',
    kev: false,
    baselineSeverity: 'Low',
    baselineKev: false,
  },
  openFindings: 1,
}

const ALL_SCOPE: DecisionView = {
  decision: buildDecision({ id: 2, scope: 'all', imageRef: null, status: 'accepted' }),
  effective: { state: 'active' },
  openFindings: 4,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('DecisionList', () => {
  it('shows why a decision re-opened inline and the scope of each decision', () => {
    const wrapper = mountWithProviders(DecisionList, {
      decisions: [REOPENED, ALL_SCOPE],
      expandedId: null,
      currentKey: null,
      findings: [],
      findingsLoaded: true,
      sort: null,
    })
    const rows = wrapper.findAll('[role="row"][aria-level]')

    expect(rows[0]!.text()).toContain(
      'Severity rose from Low to Critical on redis · ingress terminates TLS',
    )
    expect(rows[0]!.text()).toContain('nginx')
    expect(rows[1]!.text()).toContain('All images')
    expect(rows[1]!.text()).toContain('Accepted')
  })

  it('expands a decision with its actions and governed findings', async () => {
    const onEdit = vi.fn<(view: DecisionView) => void>()
    const onRevoke = vi.fn<(view: DecisionView) => void>()
    const wrapper = mountWithProviders(DecisionList, {
      decisions: [ALL_SCOPE],
      expandedId: 2,
      currentKey: null,
      findings: [buildFindingView({ id: 9, decision: ALL_SCOPE.decision })],
      findingsLoaded: true,
      sort: null,
      onEdit,
      onRevoke,
    })
    const buttons = wrapper.findAll('button')

    await buttons.find((button) => button.text().startsWith('Edit'))!.trigger('click')
    await buttons.find((button) => button.text().startsWith('Revoke'))!.trigger('click')

    expect(onEdit).toHaveBeenCalledWith(ALL_SCOPE)
    expect(onRevoke).toHaveBeenCalledWith(ALL_SCOPE)
    expect(wrapper.find('[data-finding-id="9"]').exists()).toBe(true)
  })

  it('offers no edit or revoke for a revoked decision', () => {
    const revoked: DecisionView = {
      decision: buildDecision({ id: 3, revokedAt: '2026-05-30T00:00:00.000Z', revokedBy: 'anna' }),
      effective: { state: 'revoked', revokedAt: '2026-05-30T00:00:00.000Z' },
      openFindings: 0,
    }
    const wrapper = mountWithProviders(DecisionList, {
      decisions: [revoked],
      expandedId: 3,
      currentKey: null,
      findings: [],
      findingsLoaded: true,
      sort: null,
    })
    const labels = wrapper.findAll('button').map((button) => button.text())

    expect(labels.some((label) => label.startsWith('Edit'))).toBe(false)
    expect(wrapper.text()).toContain('revoked by anna')
  })
})
