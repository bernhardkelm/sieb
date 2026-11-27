import {
  EXPOSURE_FILTERS,
  UNKNOWN_EXPOSURE,
  type Exposure,
  type ExposureFilter,
} from '#core/exposure.ts'

export const EXPOSURE_MEANINGS: Record<ExposureFilter, string> = {
  public:
    "Reachable from the internet with no gate in front; the app's own login does not count. Remote unauthenticated exploitation is possible if the vulnerable code handles request input.",
  gated:
    "Not directly reachable from the internet: a gate in front of the app (forward-auth or SSO proxy, IP allowlist) restricts who can reach it at all; the app's own login does not count, that stays public. An attacker first has to pass the gate (a valid login at the proxy, an allowed source address, or a flaw in the gate); the app's pre-auth flaws are out of reach for everyone else.",
  internal:
    'No route from outside the cluster, reachable only from inside (other pods, nodes). Exploitation needs a foothold in the cluster (lateral movement, SSRF), within the limits of network policies.',
  unknown: 'No exposure label, treat the workload as possibly reachable.',
}

export const EXPOSURE_CAVEAT =
  'Exposure describes the network entry only. It does not lower the risk of flaws triggered by processed data (uploaded or fetched files, feeds, parsed images or archives), or of tools that never run in the request path.'

export const EXPOSURE_CAVEAT_SHORT =
  'Network entry only: it does not lower the risk of flaws in processed data such as uploads, fetched files or archives.'

/**
 * Returns the meaning of an exposure tier.
 * @param {Exposure | null} exposure - Exposure, null when unknown
 * @returns {string} - Meaning
 */
export const exposureMeaning = (exposure: Exposure | null): string =>
  EXPOSURE_MEANINGS[exposure ?? UNKNOWN_EXPOSURE]

/**
 * Builds the note that explains the exposure tiers of a result, each tier once in the order
 * public, gated, internal, unknown, followed by the caveat.
 * @param {readonly (Exposure | null)[]} exposures - Exposures in the result, null for unknown
 * @returns {string | null} - Note, null when no entry carries an exposure label
 */
export const exposureNote = (exposures: readonly (Exposure | null)[]): string | null => {
  if (exposures.every((exposure) => exposure === null)) {
    return null
  }

  const present = new Set(exposures.map((exposure) => exposure ?? UNKNOWN_EXPOSURE))
  const tiers = EXPOSURE_FILTERS.filter((tier) => present.has(tier)).map(
    (tier) => `${tier}: ${EXPOSURE_MEANINGS[tier]}`,
  )

  return [...tiers, EXPOSURE_CAVEAT].join('\n')
}
