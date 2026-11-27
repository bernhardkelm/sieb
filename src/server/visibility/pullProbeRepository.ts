import type { DatabaseSync } from 'node:sqlite'

import type { PullProbeResult } from '#core/imageVisibility.ts'

/** One cached pull probe of an image repository */
export interface StoredPullProbe {
  result: PullProbeResult
  reason: string | null // short reason of a failed or restricted probe
  probedAt: string
}

const HOUR_MS = 60 * 60_000

/** How long a probe answer stays fresh: public 7 days, restricted 24 hours, failed 1 hour */
export const PROBE_TTL_MS: Readonly<Record<PullProbeResult, number>> = {
  public: 7 * 24 * HOUR_MS,
  restricted: 24 * HOUR_MS,
  failed: HOUR_MS,
}

const MAX_REASON_LENGTH = 100

/**
 * Reads the cached probe of an image repository.
 * @param {DatabaseSync} db - Open database
 * @param {string} imageRef - Image ref, registry/repository without tag
 * @returns {StoredPullProbe | null} - Probe, null while never probed
 */
export const readPullProbe = (db: DatabaseSync, imageRef: string): StoredPullProbe | null => {
  const row = db
    .prepare('SELECT result, reason, probed_at FROM image_pull_probes WHERE image_ref = ?')
    .get(imageRef) as
    | { result: PullProbeResult; reason: string | null; probed_at: string }
    | undefined

  return row === undefined
    ? null
    : { result: row.result, reason: row.reason, probedAt: row.probed_at }
}

/**
 * Returns whether a cached probe still holds, by the lifetime of its result.
 * @param {StoredPullProbe | null} probe - Cached probe, null while never probed
 * @param {Date} now - Current time
 * @returns {boolean} - True while fresh
 */
export const isFreshProbe = (probe: StoredPullProbe | null, now: Date): boolean =>
  probe !== null && now.getTime() - Date.parse(probe.probedAt) < PROBE_TTL_MS[probe.result]

/**
 * Stores the probe of an image repository, replacing the previous one.
 * @param {DatabaseSync} db - Open database
 * @param {string} imageRef - Image ref
 * @param {{ result: PullProbeResult; reason: string | null }} outcome - Result and short reason
 * @param {Date} now - Probe time
 * @returns {void}
 */
export const storePullProbe = (
  db: DatabaseSync,
  imageRef: string,
  outcome: { result: PullProbeResult; reason: string | null },
  now: Date,
): void => {
  const reason = outcome.reason === null ? null : outcome.reason.slice(0, MAX_REASON_LENGTH) || null

  db.prepare(
    `INSERT INTO image_pull_probes (image_ref, result, reason, probed_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (image_ref) DO UPDATE SET result = excluded.result, reason = excluded.reason,
       probed_at = excluded.probed_at`,
  ).run(imageRef, outcome.result, reason, now.toISOString())
}

/**
 * Returns the reference to probe for an image: the digest of the most recently seen instance,
 * open ones first, else its tag, else latest.
 * @param {DatabaseSync} db - Open database
 * @param {string} imageRef - Image ref
 * @returns {string} - Digest or tag
 */
export const probeReferenceOf = (db: DatabaseSync, imageRef: string): string => {
  const row = db
    .prepare(
      `SELECT i.image_digest, i.image_tag FROM finding_instances i JOIN findings f ON f.id = i.finding_id
       WHERE f.image_ref = ? AND (i.image_digest IS NOT NULL OR i.image_tag IS NOT NULL)
       ORDER BY i.resolved_at IS NOT NULL, i.image_digest IS NULL, i.last_seen DESC LIMIT 1`,
    )
    .get(imageRef) as { image_digest: string | null; image_tag: string | null } | undefined
  const digest = row?.image_digest ?? ''
  const tag = row?.image_tag ?? ''

  if (/^[a-z0-9]+:[a-f0-9]{32,128}$/u.test(digest)) {
    return digest
  }

  return /^\w[\w.-]{0,127}$/u.test(tag) ? tag : 'latest'
}
