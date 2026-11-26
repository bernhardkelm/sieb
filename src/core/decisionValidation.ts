import {
  DECISION_SCOPES,
  DECISION_STATUSES,
  type DecisionInput,
  type DecisionPatch,
  type DecisionScope,
  type DecisionStatus,
} from '#core/decision.ts'
import { defaultExpiresAt } from '#core/decisionExpiry.ts'
import { nonBlank, readExpiry, readLiteral, readText } from '#core/decisionFieldReaders.ts'
import type { DecisionInputError, Validated } from '#core/decisionInputError.ts'

type RawInput = Record<string, unknown>

/**
 * Validates the input of a new decision. The reason is trimmed, mandatory and at most
 * MAX_REASON_LENGTH characters, scope image needs
 * an image_ref and scope all must not have one, and an omitted expiry gets the default of the
 * status while an explicit null keeps it open-ended.
 * @param {RawInput} raw - Parsed request body
 * @param {Date} now - Current time
 * @returns {Validated<DecisionInput>} - Validated input or the list of errors
 */
export const validateDecisionInput = (raw: RawInput, now: Date): Validated<DecisionInput> => {
  const errors: DecisionInputError[] = []
  const vulnId = nonBlank(raw.vulnId)
  const scope = readLiteral<DecisionScope>(raw.scope, DECISION_SCOPES, 'scope', errors)
  const status = readLiteral<DecisionStatus>(raw.status, DECISION_STATUSES, 'status', errors)
  const imageRef = nonBlank(raw.imageRef)
  const expiresAt = readExpiry(raw.expiresAt, now, errors)

  if (vulnId === null) {
    errors.push({ field: 'vulnId', code: 'required' })
  }

  const reason = readText(raw.reason, 'reason', errors)

  if (scope === 'image' && imageRef === null) {
    errors.push({ field: 'imageRef', code: 'required' })
  }

  if (scope === 'all' && raw.imageRef !== undefined && raw.imageRef !== null) {
    errors.push({ field: 'imageRef', code: 'not_allowed' })
  }

  if (
    errors.length > 0 ||
    vulnId === null ||
    scope === null ||
    status === null ||
    reason === null
  ) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      vulnId,
      scope,
      imageRef: scope === 'image' ? imageRef : null,
      status,
      reason,
      expiresAt: expiresAt === undefined ? defaultExpiresAt(status, now) : expiresAt,
    },
  }
}

/**
 * Validates a change of an existing decision. Only status, reason and expiresAt may change,
 * reconfirm true re-confirms the decision at the current findings, at least one of them must be
 * present, and a present reason must not be blank. reconfirm false counts as absent.
 * @param {RawInput} raw - Parsed request body
 * @param {Date} now - Current time
 * @returns {Validated<DecisionPatch>} - Validated patch or the list of errors
 */
export const validateDecisionPatch = (raw: RawInput, now: Date): Validated<DecisionPatch> => {
  const errors: DecisionInputError[] = []
  const patch: DecisionPatch = {}

  if (raw.status !== undefined) {
    const status = readLiteral<DecisionStatus>(raw.status, DECISION_STATUSES, 'status', errors)

    if (status !== null) {
      patch.status = status
    }
  }

  if (raw.reason !== undefined) {
    const reason = readText(raw.reason, 'reason', errors)

    if (reason !== null) {
      patch.reason = reason
    }
  }

  if (raw.reconfirm !== undefined && typeof raw.reconfirm !== 'boolean') {
    errors.push({ field: 'reconfirm', code: 'invalid' })
  } else if (raw.reconfirm === true) {
    patch.reconfirm = true
  }

  const expiresAt = readExpiry(raw.expiresAt, now, errors)

  if (expiresAt !== undefined) {
    patch.expiresAt = expiresAt
  }

  if (errors.length === 0 && Object.keys(patch).length === 0) {
    errors.push({ field: null, code: 'empty_patch' })
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: patch }
}
