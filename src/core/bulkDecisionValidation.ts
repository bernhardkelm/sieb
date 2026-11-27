import type { DecisionInput } from '#core/decision.ts'
import { nonBlank } from '#core/decisionFieldReaders.ts'
import type { DecisionInputError } from '#core/decisionInputError.ts'
import { validateDecisionInput } from '#core/decisionValidation.ts'
import type { Validation } from '#core/validation.ts'

export const ALL_OPEN_IMAGES = 'all-open'

export const MAX_BULK_IMAGES = 200

/** Validated input for image-scoped decisions of one vuln_id in several images */
export interface BulkDecisionInput extends Pick<
  DecisionInput,
  'vulnId' | 'status' | 'justification' | 'reason' | 'expiresAt' | 'upstreamPending' | 'waitingFor'
> {
  imageRefs: string[] | typeof ALL_OPEN_IMAGES // all-open: every image with an open finding
}

/**
 * Reads the target images: the literal all-open or a non-empty list of at most MAX_BULK_IMAGES
 * non-blank image refs, trimmed and deduplicated.
 * @param {unknown} value - Raw imageRefs
 * @param {DecisionInputError[]} errors - Collected errors, appended to
 * @returns {string[] | typeof ALL_OPEN_IMAGES | null} - Images, null when invalid
 */
const readImageRefs = (
  value: unknown,
  errors: DecisionInputError[],
): string[] | typeof ALL_OPEN_IMAGES | null => {
  if (value === ALL_OPEN_IMAGES) {
    return ALL_OPEN_IMAGES
  }

  if (Array.isArray(value) && value.length > MAX_BULK_IMAGES) {
    errors.push({ field: 'imageRefs', code: 'too_many' })
    return null
  }

  const refs = Array.isArray(value) ? value.map(nonBlank) : []

  if (refs.length === 0 || refs.includes(null)) {
    errors.push({ field: 'imageRefs', code: value === undefined ? 'required' : 'invalid' })
    return null
  }

  return [...new Set(refs as string[])]
}

/**
 * Validates a bulk decision: the fields of a single decision without scope and image_ref, the
 * expiry default, the justification and the upstream rules included, plus the target images.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @param {Date} now - Current time
 * @returns {Validation<BulkDecisionInput, DecisionInputError>} - Validated input or the list of errors
 */
export const validateBulkDecisionInput = (
  raw: Record<string, unknown>,
  now: Date,
): Validation<BulkDecisionInput, DecisionInputError> => {
  const errors: DecisionInputError[] = []
  const imageRefs = readImageRefs(raw.imageRefs, errors)
  const single = validateDecisionInput(
    {
      vulnId: raw.vulnId,
      scope: 'all',
      status: raw.status,
      justification: raw.justification,
      reason: raw.reason,
      expiresAt: raw.expiresAt,
      upstreamPending: raw.upstreamPending,
      waitingFor: raw.waitingFor,
    },
    now,
  )

  if (!single.ok) {
    errors.unshift(...single.errors)
  }

  if (!single.ok || imageRefs === null) {
    return { ok: false, errors }
  }

  const { scope: _scope, imageRef: _imageRef, ...values } = single.value

  return { ok: true, value: { ...values, imageRefs } }
}
