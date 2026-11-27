import { createHmac, randomBytes } from 'node:crypto'

import type { AccessTestResult } from '#core/privateAccess.ts'
import type { CredentialCandidate } from '#server/credentials/candidateTest.ts'

/** The last test of entered values per user, so a save right after a test needs no second run */
export interface RecentTests {
  remember: (actor: string, candidate: CredentialCandidate, result: AccessTestResult) => void
  recall: (actor: string, candidate: CredentialCandidate) => AccessTestResult | null // null unless the same values were tested within the window
  forget: (actor: string) => void
}

/**
 * Creates the memory of recent tests: one entry per user, matched by an HMAC of the values and
 * secret under a key that lives only in this process, so the secret itself is never kept.
 * @param {() => number} now - Milliseconds of the clock
 * @param {number} windowMs - How long a result answers for the same values, the test cooldown
 * @returns {RecentTests} - Remember, recall and forget calls
 */
export const createRecentTests = (now: () => number, windowMs: number): RecentTests => {
  const key = randomBytes(32)
  const entries = new Map<string, { digest: string; result: AccessTestResult; at: number }>()

  /**
   * Returns the digest of tested values.
   * @param {CredentialCandidate} candidate - Values and secret
   * @returns {string} - Hex HMAC
   */
  const digestOf = (candidate: CredentialCandidate): string =>
    createHmac('sha256', key)
      .update(JSON.stringify([candidate.id, candidate.fields, candidate.secret]))
      .digest('hex')

  return {
    remember: (actor, candidate, result) => {
      entries.set(actor, { digest: digestOf(candidate), result, at: now() })
    },
    recall: (actor, candidate) => {
      const entry = entries.get(actor)

      if (entry === undefined || now() - entry.at >= windowMs) {
        return null
      }

      return entry.digest === digestOf(candidate) ? entry.result : null
    },
    forget: (actor) => {
      entries.delete(actor)
    },
  }
}
