export const EXPOSURES = ['public', 'gated', 'internal'] as const

export type Exposure = (typeof EXPOSURES)[number]

// unknown (null) ranks below gated and above internal: it may be reachable, but less surely than public
const EXPOSURE_RANKS: Record<Exposure, number> = { public: 3, gated: 2, internal: 0 }
const UNKNOWN_EXPOSURE_RANK = 1

/**
 * Returns the rank of an exposure, higher is more exposed.
 * @param {Exposure | null} exposure - Exposure, null when unknown
 * @returns {number} - 3 for public, 2 for gated, 1 for unknown, 0 for internal
 */
export const exposureRank = (exposure: Exposure | null): number =>
  exposure === null ? UNKNOWN_EXPOSURE_RANK : EXPOSURE_RANKS[exposure]

/**
 * Compares two exposures for a sort with the most exposed first, unknown between gated and
 * internal.
 * @param {Exposure | null} a - First exposure
 * @param {Exposure | null} b - Second exposure
 * @returns {number} - Negative when a sorts before b
 */
export const compareExposure = (a: Exposure | null, b: Exposure | null): number =>
  exposureRank(b) - exposureRank(a)

/**
 * Returns the most exposed of several exposures, unknown outranking internal.
 * @param {readonly (Exposure | null)[]} exposures - Exposures, null for unknown
 * @returns {Exposure | null} - Most exposed one, null for unknown or an empty list
 */
export const maxExposure = (exposures: readonly (Exposure | null)[]): Exposure | null => {
  let max: Exposure | null = null
  let maxRank = -1

  for (const exposure of exposures) {
    if (exposureRank(exposure) > maxRank) {
      max = exposure
      maxRank = exposureRank(exposure)
    }
  }

  return max
}

/**
 * Returns whether a value is a known exposure label.
 * @param {unknown} value - Value to test
 * @returns {boolean} - True for public, gated and internal
 */
export const isExposure = (value: unknown): value is Exposure =>
  (EXPOSURES as readonly unknown[]).includes(value)

/**
 * Parses an exposure label case-insensitively.
 * @param {unknown} value - Raw label
 * @returns {Exposure | null} - Matching exposure, null for missing or unrecognised values
 */
export const parseExposure = (value: unknown): Exposure | null => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : null

  return isExposure(normalized) ? normalized : null
}
