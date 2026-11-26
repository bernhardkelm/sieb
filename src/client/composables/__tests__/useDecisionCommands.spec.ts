import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BulkDecisionResult } from '#core/apiTypes.ts'
import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { DecisionView, FindingView } from '#core/findingView.ts'
import { ApiError } from '@/api/ApiError'
import {
  createBulkDecisions,
  createDecision,
  revokeDecision,
  updateDecision,
} from '@/api/decisionsApi'
import { fetchFindings } from '@/api/findingsApi'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'
import { useDecisionCommands } from '@/composables/useDecisionCommands'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { useFindingsStore } from '@/stores/findingsStore'
import { notifyError, notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/decisionsApi', () => ({
  createDecision: vi.fn<typeof createDecision>(),
  updateDecision: vi.fn<typeof updateDecision>(),
  revokeDecision: vi.fn<typeof revokeDecision>(),
  createBulkDecisions: vi.fn<typeof createBulkDecisions>(),
}))
vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
}))

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

const VALUE: DecisionFormValue = {
  status: 'accepted',
  reason: 'internal only',
  scope: 'image',
  expiresAt: null,
  expiryTouched: false,
  reconfirm: false,
}

/**
 * Loads findings into the store, as the inbox has them before a decision.
 * @param {FindingView[]} findings - Loaded findings
 * @returns {Promise<ReturnType<typeof useFindingsStore>>} - Loaded store
 */
const loadFindings = async (
  findings: FindingView[],
): Promise<ReturnType<typeof useFindingsStore>> => {
  vi.mocked(fetchFindings).mockResolvedValue(findings)

  const store = useFindingsStore()

  await store.refresh()
  vi.mocked(fetchFindings).mockReturnValue(new Promise(() => {}))
  return store
}

/**
 * Builds a written decision with its state.
 * @param {Partial<DecisionView['decision']>} overrides - Decision fields
 * @param {DecisionView['effective']} effective - State
 * @returns {DecisionView} - Decision view
 */
const written = (
  overrides: Partial<DecisionView['decision']>,
  effective: DecisionView['effective'] = { state: 'active' },
): DecisionView => ({ decision: buildDecision(overrides), effective, openFindings: 1 })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useDecisionCommands', () => {
  it('takes a decided finding out of the inbox at once and bumps the data version', async () => {
    const store = await loadFindings([
      buildFindingView({ id: 1, imageRef: NGINX }),
      buildFindingView({ id: 2, imageRef: REDIS }),
    ])
    const view = written({ id: 5, imageRef: NGINX, status: 'accepted' })
    vi.mocked(createDecision).mockResolvedValue(view)

    await useDecisionCommands().save({ vulnId: 'CVE-2025-1234', imageRef: NGINX }, null, VALUE)

    expect(store.items.map((finding) => [finding.id, finding.inInbox])).toEqual([
      [1, false],
      [2, true],
    ])
    expect(store.items[0]!.decision?.id).toBe(5)
    expect(useDataVersionStore().version).toBe(1)
    expect(notifySuccess).toHaveBeenCalledWith('Accepted: CVE-2025-1234', 'For nginx')
  })

  it('patches only the changed fields of an existing decision', async () => {
    await loadFindings([])
    const existing = buildDecision({ id: 5, status: 'accepted', reason: 'old', expiresAt: null })
    vi.mocked(updateDecision).mockResolvedValue(written({ id: 5, reason: 'internal only' }))

    await useDecisionCommands().save({ vulnId: existing.vulnId, imageRef: NGINX }, existing, VALUE)

    expect(updateDecision).toHaveBeenCalledWith(5, { reason: 'internal only' })
  })

  it('leaves the inbox to the refetch after a revoke', async () => {
    const all = buildDecision({ id: 9, scope: 'all', imageRef: null })
    const store = await loadFindings([
      buildFindingView({ id: 1, decision: all, effective: { state: 'active' }, inInbox: false }),
    ])
    vi.mocked(revokeDecision).mockResolvedValue(
      written({ id: 4 }, { state: 'revoked', revokedAt: '2026-06-01T12:00:00.000Z' }),
    )

    await useDecisionCommands().revoke(4, '')

    expect(store.items[0]!.inInbox).toBe(false)
    expect(useDataVersionStore().version).toBe(1)
  })

  it('applies the decisions written before a bulk failed and toasts the failure', async () => {
    const store = await loadFindings([
      buildFindingView({ id: 1, vulnId: 'CVE-A', imageRef: NGINX }),
      buildFindingView({ id: 2, vulnId: 'CVE-B', imageRef: NGINX }),
    ])
    const first: BulkDecisionResult = {
      created: [written({ id: 7, vulnId: 'CVE-A', imageRef: NGINX })],
      skipped: [],
    }
    const failure = new ApiError(500, {}, '/api/decisions/bulk')
    vi.mocked(createBulkDecisions).mockResolvedValueOnce(first).mockRejectedValueOnce(failure)

    const outcome = useDecisionCommands().bulkDecide(
      [
        { vulnId: 'CVE-A', imageRefs: [NGINX] },
        { vulnId: 'CVE-B', imageRefs: [NGINX] },
      ],
      VALUE,
    )

    await expect(outcome).rejects.toBe(failure)
    expect(store.items.map((finding) => finding.inInbox)).toEqual([false, true])
    expect(useDataVersionStore().version).toBe(1)
    expect(notifyError).toHaveBeenCalledWith('Bulk decision incomplete', failure)
  })

  it('keeps findings with their own image decision out of an all-scope decision', async () => {
    const own = buildDecision({ id: 3, imageRef: NGINX })
    const store = await loadFindings([
      buildFindingView({
        id: 1,
        imageRef: NGINX,
        decision: own,
        effective: { state: 'expired', expiresAt: 'x' },
      }),
      buildFindingView({ id: 2, imageRef: REDIS }),
    ])

    store.applyDecision(buildDecision({ id: 8, scope: 'all', imageRef: null }), {
      state: 'active',
    })

    expect(store.items.map((finding) => finding.decision?.id ?? null)).toEqual([3, 8])
    expect(store.items[1]!.inInbox).toBe(false)
  })
})
