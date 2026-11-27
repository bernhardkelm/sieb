import type { CheckedImage, CheckPhase, CheckState, CheckUsage, CheckView } from '#core/check.ts'
import type { CheckedSource } from '#core/privateAccess.ts'

export interface CheckRow {
  id: number
  finding_id: number
  vuln_id: string
  image_ref: string
  requested_by: string
  state: string
  phase: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  heartbeat_at: string | null
  token_id: number | null
  proposal_id: number | null
  error: string | null
  duration_ms: number | null
  usage: string | null
  reply: string | null
  pulled_digest: string | null
  pulled_images: string | null
  source: string | null
}

/** Stored check with the fields the client view leaves out */
export interface StoredCheck {
  id: number
  findingId: number
  vulnId: string
  imageRef: string
  requestedBy: string
  state: CheckState
  phase: CheckPhase | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  heartbeatAt: string | null
  tokenId: number | null
  proposalId: number | null
  error: string | null
  durationMs: number | null // reported by the worker
  usage: CheckUsage | null
  reply: string | null
  pulledDigest: string | null
  pulledImages: CheckedImage[] | null // null for checks that ended before schema step 18
  source: CheckedSource | null // null without a checked out repository and before schema step 20
}

/**
 * Maps a checks row to the stored check.
 * @param {CheckRow} row - Row
 * @returns {StoredCheck} - Check
 */
export const toStoredCheck = (row: CheckRow): StoredCheck => ({
  id: row.id,
  findingId: row.finding_id,
  vulnId: row.vuln_id,
  imageRef: row.image_ref,
  requestedBy: row.requested_by,
  state: row.state as CheckState,
  phase: row.phase as CheckPhase | null,
  createdAt: row.created_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  heartbeatAt: row.heartbeat_at,
  tokenId: row.token_id,
  proposalId: row.proposal_id,
  error: row.error,
  durationMs: row.duration_ms,
  usage: row.usage === null ? null : (JSON.parse(row.usage) as CheckUsage),
  reply: row.reply,
  pulledDigest: row.pulled_digest,
  pulledImages:
    row.pulled_images === null ? null : (JSON.parse(row.pulled_images) as CheckedImage[]),
  source: row.source === null ? null : (JSON.parse(row.source) as CheckedSource),
})

/**
 * Returns how long a check ran: the duration the worker reported, else the time between start
 * and end, null while it has not ended or never started.
 * @param {StoredCheck} check - Check
 * @returns {number | null} - Milliseconds
 */
const durationOf = (check: StoredCheck): number | null => {
  if (check.durationMs !== null) {
    return check.durationMs
  }

  if (check.startedAt === null || check.finishedAt === null) {
    return null
  }

  return Math.max(0, Date.parse(check.finishedAt) - Date.parse(check.startedAt))
}

/**
 * Returns the images a check exported, for an older check its pulled digest without tag.
 * @param {StoredCheck} check - Check
 * @returns {CheckedImage[]} - Images, primary first, empty when the worker reported none
 */
const pulledImagesOf = (check: StoredCheck): CheckedImage[] =>
  check.pulledImages ??
  (check.pulledDigest === null ? [] : [{ digest: check.pulledDigest, tag: null }])

/**
 * Maps a stored check to the client view, the phase only while running.
 * @param {StoredCheck} check - Check
 * @param {number | null} position - 1-based queue position of a queued check, else null
 * @returns {CheckView} - View
 */
export const toCheckView = (check: StoredCheck, position: number | null = null): CheckView => ({
  id: check.id,
  findingId: check.findingId,
  vulnId: check.vulnId,
  imageRef: check.imageRef,
  requestedBy: check.requestedBy,
  state: check.state,
  phase: check.state === 'running' ? check.phase : null,
  position: check.state === 'queued' ? position : null,
  createdAt: check.createdAt,
  startedAt: check.startedAt,
  finishedAt: check.finishedAt,
  durationMs: durationOf(check),
  error: check.error,
  proposalId: check.proposalId,
  usage: check.usage,
  reply: check.reply,
  pulledDigest: check.pulledDigest,
  pulledImages: pulledImagesOf(check),
  source: check.source,
})
