import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildDecision } from '#core/__tests__/coreBuilders.ts'
import type { CveAggregate } from '#core/cveAggregation.ts'
import type { EffectiveDecision } from '#core/effectiveDecision.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import { reopenedEffective } from '@/__tests__/reopenedEffective'
import CveDecisionDialog from '@/components/cves/CveDecisionDialog.vue'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'

const save =
  vi.fn<(target: unknown, existing: unknown, value: DecisionFormValue) => Promise<unknown>>()

vi.mock('@/composables/useDecisionCommands', () => ({
  useDecisionCommands: () => ({ save, bulkDecide: vi.fn<() => Promise<unknown>>() }),
}))

/**
 * Builds a CVE whose all-scope decision has not been latched as re-opened by a sync.
 * @param {EffectiveDecision} effective - State of the all-scope decision
 * @returns {CveAggregate} - Aggregate
 */
const cve = (effective: EffectiveDecision): CveAggregate => ({
  vulnId: 'CVE-2025-1000',
  title: null,
  primaryLink: null,
  kev: false,
  maxSeverity: 'Critical',
  maxScore: null,
  maxExposure: null,
  imageCount: 1,
  imageRefs: ['index.docker.io/library/nginx'],
  openCount: 1,
  inboxCount: 0,
  decisionStates: {
    undecided: 0,
    active: 0,
    fix_planned: 0,
    expired: 0,
    reopened: 1,
    revoked: 0,
  },
  allScopeDecision: buildDecision({ id: 7, scope: 'all', imageRef: null, reopenedAt: null }),
  allScopeEffective: effective,
})

/**
 * Mounts the open dialog and waits for its auto focus.
 * @param {EffectiveDecision} effective - State of the all-scope decision
 * @returns {Promise<void>} - Resolves once mounted
 */
const mountDialog = async (effective: EffectiveDecision): Promise<void> => {
  mountWithProviders(CveDecisionDialog, { open: true, cve: cve(effective) })
  await flushPromises()
}

/**
 * Returns the re-confirm checkbox of the form.
 * @returns {HTMLInputElement | null} - Checkbox, null when not offered
 */
const reconfirmBox = (): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>('input[name="reconfirm"]')

afterEach(() => {
  save.mockReset()
  document.body.innerHTML = ''
})

describe('CveDecisionDialog', () => {
  it('offers re-confirm for a pending re-open and saves it', async () => {
    save.mockResolvedValue({})
    await mountDialog(reopenedEffective({ reopenedAt: null }))
    const box = reconfirmBox()!

    box.checked = true
    box.dispatchEvent(new Event('change'))
    document
      .querySelector('textarea')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }))
    await flushPromises()

    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.calls[0]?.[2].reconfirm).toBe(true)
  })

  it('does not offer re-confirm while the decision is in effect', async () => {
    await mountDialog({ state: 'active' })

    expect(document.querySelector('textarea')).not.toBeNull()
    expect(reconfirmBox()).toBeNull()
  })
})
