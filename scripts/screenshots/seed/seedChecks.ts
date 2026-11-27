import type { CheckCreateResponse, ChecksResponse, WorkerClaim } from '#core/check.ts'
import { finishedChecks, type FinishedCheckSeed } from '#scripts/screenshots/seed/checkSeeds.ts'
import { acceptProposal } from '#scripts/screenshots/seed/proposalActions.ts'
import { REVIEW_PROPOSAL, REVIEW_RELATED } from '#scripts/screenshots/seed/reviewProposal.ts'
import { IMAGE, type FindingLookup } from '#scripts/screenshots/seed/seedImages.ts'
import type { McpClient, SiebApi } from '#scripts/screenshots/seed/siebApi.ts'

export interface CheckTargets {
  running: { vulnId: string; imageRef: string }
  cancelled: { vulnId: string; imageRef: string }
  queued: { vulnId: string; imageRef: string; byOther: boolean }[]
}

export interface SeededChecks {
  runningCheckId: number
}

const CHECK_CLIENT: McpClient = { name: 'claude-code', userAgent: 'claude-code/2.1.4 (sdk-cli)' }

/**
 * Queues findings as Auto-checks and returns the queued checks.
 * @param {SiebApi} api - Seed client
 * @param {number[]} findingIds - Findings
 * @param {string} [user] - Requesting user, the dev user when absent
 * @returns {Promise<CheckCreateResponse>} - Queued checks
 * @throws {Error} - When sieb skips a finding, for example one no credential covers
 */
const queue = async (
  api: SiebApi,
  findingIds: number[],
  user?: string,
): Promise<CheckCreateResponse> => {
  const answer = await api.request<CheckCreateResponse>('POST', '/api/checks', { findingIds }, user)

  if (answer.skipped.length > 0) {
    throw new Error(`Auto-check skipped findings: ${JSON.stringify(answer.skipped)}`)
  }

  return answer
}

/**
 * Runs one finished check the way the worker reports it: claim, heartbeat, the proposal through
 * MCP with the check's token, then the result.
 * @param {SiebApi} api - Seed client
 * @param {FinishedCheckSeed} seed - Check outcome
 * @param {FindingLookup} id - Finding lookup
 * @returns {Promise<void>} - Resolves once the result is stored
 */
const runCheck = async (
  api: SiebApi,
  seed: FinishedCheckSeed,
  id: FindingLookup,
): Promise<void> => {
  await queue(api, [id(seed.vulnId, seed.imageRef)])
  const claim = await api.worker<WorkerClaim>('/claim')
  const digests = (claim.images ?? []).flatMap((image) => image.imageDigest ?? [])

  await api.worker(`/checks/${claim.checkId}/heartbeat`, { phase: 'investigating' })

  if (seed.proposal !== null) {
    const related =
      seed.proposal === REVIEW_PROPOSAL
        ? REVIEW_RELATED.map((vulnId) => ({
            findingId: id(vulnId, IMAGE.nginx),
            note: 'Same libcrypto3 3.3.2-r0, fixed in 3.3.3-r0.',
          }))
        : undefined
    const args = { ...seed.proposal, findingId: claim.findingId, relatedFindings: related }

    await api.callTool(claim.token, CHECK_CLIENT, 'propose_decision', args)
  }

  await api.worker(`/checks/${claim.checkId}/result`, {
    status: seed.status,
    error: seed.error,
    durationMs: seed.durationMs,
    usage: seed.usage,
    reply: seed.reply || null,
    pulledDigest: digests[0] ?? null,
    pulledDigests: digests,
    source: seed.source,
  })
}

/**
 * Seeds the Checks page: a cancelled check, the finished checks, accepting the proposals that
 * should leave the Inbox, a running one claimed by the worker and two queued, one of them by
 * the second user.
 * @param {SiebApi} api - Seed client
 * @param {FindingLookup} id - Finding lookup
 * @param {CheckTargets} targets - Findings of the running, cancelled and queued checks
 * @param {string} otherUser - Second user
 * @returns {Promise<SeededChecks>} - Id of the running check, which needs heartbeats
 */
export const seedChecks = async (
  api: SiebApi,
  id: FindingLookup,
  targets: CheckTargets,
  otherUser: string,
): Promise<SeededChecks> => {
  const cancelled = await queue(api, [id(targets.cancelled.vulnId, targets.cancelled.imageRef)])

  for (const check of cancelled.queued) {
    await api.request('DELETE', `/api/checks/${check.id}`)
  }

  for (const seed of finishedChecks()) {
    await runCheck(api, seed, id)

    if (seed.accept) {
      await acceptProposal(api, seed.vulnId, seed.imageRef)
    }
  }

  await queue(api, [id(targets.running.vulnId, targets.running.imageRef)])
  const running = await api.worker<WorkerClaim>('/claim')

  await api.worker(`/checks/${running.checkId}/heartbeat`, { phase: 'investigating' })

  for (const target of targets.queued) {
    await queue(api, [id(target.vulnId, target.imageRef)], target.byOther ? otherUser : undefined)
  }

  const overview = await api.request<ChecksResponse>('GET', '/api/checks')

  if (overview.running?.id !== running.checkId) {
    throw new Error('the running check did not stay running')
  }

  return { runningCheckId: running.checkId }
}
