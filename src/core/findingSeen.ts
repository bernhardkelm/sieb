import type { ValidationIssue } from '#core/errorApiTypes.ts'
import { MAX_SEEN_KEYS } from '#core/inbox/seenValidation.ts'
import type { Validation } from '#core/validation.ts'

/** Prefix of the inbox_seen keys that mark a finding seen */
export const FINDING_SEEN_PREFIX = 'finding:'

/** Most ids one POST /api/findings/seen marks */
export const MAX_SEEN_FINDINGS = MAX_SEEN_KEYS

/**
 * Builds the inbox_seen key of a seen finding.
 * @param {number} findingId - Finding id
 * @returns {string} - Key
 */
export const findingSeenKey = (findingId: number): string => `${FINDING_SEEN_PREFIX}${findingId}`

/**
 * Validates the body of POST /api/findings/seen: ids is a list of at most MAX_SEEN_FINDINGS
 * positive integer finding ids. Duplicates collapse.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @returns {Validation<number[]>} - Distinct ids or the list of errors
 */
export const validateSeenFindingIds = (raw: Record<string, unknown>): Validation<number[]> => {
  const { ids } = raw

  if (!Array.isArray(ids)) {
    return {
      ok: false,
      errors: [{ field: 'ids', code: ids === undefined ? 'required' : 'invalid' }],
    }
  }

  if (ids.length > MAX_SEEN_FINDINGS) {
    return { ok: false, errors: [{ field: 'ids', code: 'too_many' }] }
  }

  const errors: ValidationIssue[] = ids.flatMap((id: unknown, index) =>
    typeof id === 'number' && Number.isSafeInteger(id) && id > 0
      ? []
      : [{ field: `ids.${index}`, code: 'invalid' }],
  )

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: [...new Set(ids as number[])] }
}
