import type { DecisionView } from '#core/findingView.ts'
import type { ApiTokenCreateResponse } from '#core/tokenApiTypes.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { pollFor } from '#scripts/screenshots/processes.ts'
import { seedChecks } from '#scripts/screenshots/seed/seedChecks.ts'
import { inDays, seedDecisions } from '#scripts/screenshots/seed/seedDecisions.ts'
import { IMAGE, findingLookup, type FindingRef } from '#scripts/screenshots/seed/seedImages.ts'
import { fileProposals, openProposalId } from '#scripts/screenshots/seed/proposalActions.ts'
import {
  clientProposals,
  OUTDATING_DECISION,
  outdatedProposal,
} from '#scripts/screenshots/seed/proposalSeeds.ts'
import type { SiebApi } from '#scripts/screenshots/seed/siebApi.ts'

export interface SeededState {
  reviewProposalId: number
  inconclusiveProposalId: number
  runningCheckId: number
  panelFindingId: number // own image, KEV listed and public, already seen
  reopenedDecisionId: number
}

/** Findings that keep the new tag in Triage, every other finding is marked seen */
const UNSEEN = [
  ['CVE-2099-34648', IMAGE.demoApp],
  ['CVE-2099-34648', IMAGE.nginx],
  ['CVE-2099-73644', IMAGE.nginx],
  ['CVE-2099-73644', IMAGE.demoApp],
] as const

/** Newly KEV listed findings that stay in the Inbox, the other KEV items are marked seen */
const KEV_KEPT = [
  ['CVE-2099-34648', IMAGE.nginx],
  ['CVE-2099-34648', IMAGE.demoApp],
] as const

const SEEN_BATCH = 200

/**
 * Posts ids or keys to a seen endpoint in batches the server accepts.
 * @param {SiebApi} api - Seed client
 * @param {string} path - Endpoint
 * @param {string} field - Body field, ids or keys
 * @param {readonly (number | string)[]} values - Values to mark
 * @returns {Promise<void>} - Resolves once all are marked
 */
const markSeen = async (
  api: SiebApi,
  path: string,
  field: string,
  values: readonly (number | string)[],
): Promise<void> => {
  for (let start = 0; start < values.length; start += SEEN_BATCH) {
    await api.request('POST', path, { [field]: values.slice(start, start + SEEN_BATCH) })
  }
}

/**
 * Returns the findings of the current sync state.
 * @param {SiebApi} api - Seed client
 * @returns {Promise<FindingRef[]>} - Findings
 */
const findings = (api: SiebApi): Promise<FindingRef[]> =>
  api.request<FindingRef[]>('GET', '/api/findings')

/**
 * Returns the id of the decision on a CVE.
 * @param {SiebApi} api - Seed client
 * @param {string} vulnId - CVE id
 * @returns {Promise<number>} - Decision id
 * @throws {Error} - When the CVE has no decision
 */
const decisionId = async (api: SiebApi, vulnId: string): Promise<number> => {
  const views = await api.request<DecisionView[]>('GET', '/api/decisions')
  const view = views.find(({ decision }) => decision.vulnId === vulnId)

  if (view === undefined) {
    throw new Error(`no decision on ${vulnId}`)
  }

  return view.decision.id
}

/**
 * Seeds the sandbox through the public API, MCP and the worker API: decisions on the first mock
 * state, then the second sync that re-opens two of them and lists a CVE in KEV, then proposals
 * of several clients, one of them outdated by a decision of the second user, the Auto-checks and the seen marks that leave a few new tags.
 * @param {SiebApi} api - Seed client
 * @param {string} otherUser - Second user
 * @returns {Promise<SeededState>} - Ids the shots navigate to
 */
export const seedState = async (api: SiebApi, otherUser: string): Promise<SeededState> => {
  await pollFor(async () => ((await findings(api)).length > 0 ? true : null), 30_000, 'first sync')

  const token = await api.request<ApiTokenCreateResponse>('POST', '/api/tokens', {
    name: 'Claude Code on laptop',
    scope: 'propose',
    expiresAt: inDays(90),
  })
  await seedDecisions(api, otherUser)
  await api.request('POST', '/api/sync', {})

  const current = await findings(api)
  const id = findingLookup(current)

  await fileProposals(api, token.secret, [outdatedProposal(id), ...clientProposals(id)])
  await api.request('POST', '/api/decisions', OUTDATING_DECISION, otherUser)

  const checks = await seedChecks(
    api,
    id,
    {
      running: { vulnId: 'CVE-2099-49765', imageRef: IMAGE.nginx },
      cancelled: { vulnId: 'CVE-2099-87134', imageRef: IMAGE.localPath },
      queued: [
        { vulnId: 'CVE-2099-24604', imageRef: IMAGE.redis, byOther: false },
        { vulnId: 'CVE-2099-95239', imageRef: IMAGE.metricsServer, byOther: true },
      ],
    },
    otherUser,
  )
  const unseen = new Set(UNSEEN.map(([vulnId, imageRef]) => id(vulnId, imageRef)))

  await markSeen(
    api,
    '/api/findings/seen',
    'ids',
    current.map((finding) => finding.id).filter((findingId) => !unseen.has(findingId)),
  )

  const kept = new Set(KEV_KEPT.map(([vulnId, imageRef]) => id(vulnId, imageRef)))
  const inbox = await api.request<{ items: InboxItem[] }>('GET', '/api/inbox')
  const kevKeys = inbox.items.flatMap((item) =>
    item.kind === 'kev' && !kept.has(item.refs.findingId) ? [item.key] : [],
  )

  await markSeen(api, '/api/inbox/seen', 'keys', kevKeys)

  return {
    reviewProposalId: await openProposalId(api, 'CVE-2099-91600', IMAGE.nginx),
    inconclusiveProposalId: await openProposalId(api, 'CVE-2099-55414', IMAGE.demoWorker),
    runningCheckId: checks.runningCheckId,
    panelFindingId: id('CVE-2099-34648', IMAGE.demoWorker),
    reopenedDecisionId: await decisionId(api, 'CVE-2099-94125'),
  }
}
