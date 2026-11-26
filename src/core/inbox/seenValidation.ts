import type { ValidationIssue } from '#core/apiTypes.ts'
import { inboxKindOf, seeableKindOf } from '#core/inbox/inboxKeys.ts'

/** Most keys one POST /api/inbox/seen marks */
export const MAX_SEEN_KEYS = 200

export type ValidatedKeys = { ok: true; value: string[] } | { ok: false; errors: ValidationIssue[] }

/**
 * Validates the body of POST /api/inbox/seen: keys is a list of at most MAX_SEEN_KEYS well-formed
 * expiring or KEV keys. A proposal or re-opened key answers not_seeable, those items leave the
 * Inbox by being handled. Duplicates collapse.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @returns {ValidatedKeys} - Distinct keys or the list of errors
 */
export const validateSeenKeys = (raw: Record<string, unknown>): ValidatedKeys => {
  const { keys } = raw

  if (!Array.isArray(keys)) {
    return {
      ok: false,
      errors: [{ field: 'keys', code: keys === undefined ? 'required' : 'invalid' }],
    }
  }

  if (keys.length > MAX_SEEN_KEYS) {
    return { ok: false, errors: [{ field: 'keys', code: 'too_many' }] }
  }

  const errors: ValidationIssue[] = keys.flatMap((key: unknown, index) => {
    if (typeof key === 'string' && seeableKindOf(key) !== null) {
      return []
    }

    const kind = typeof key === 'string' ? inboxKindOf(key) : null
    const handledOnly = kind === 'proposal' || kind === 'reopened'

    return [{ field: `keys.${index}`, code: handledOnly ? 'not_seeable' : 'invalid' }]
  })

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: [...new Set(keys as string[])] }
}
