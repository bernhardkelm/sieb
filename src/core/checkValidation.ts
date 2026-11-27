import type { ValidationIssue } from '#core/errorApiTypes.ts'
import {
  CHECK_PHASES,
  type CheckCreateRequest,
  type CheckPhase,
  type WorkerHeartbeat,
  type WorkerResult,
} from '#core/check.ts'
import {
  capText,
  MAX_CHECK_ERROR_LENGTH,
  MAX_CHECK_FINDINGS,
  MAX_CHECK_REPLY_LENGTH,
} from '#core/checkLimits.ts'
import { readCheckUsage } from '#core/checkUsageValidation.ts'
import { readCheckedSource } from '#core/checkedSourceValidation.ts'
import { readPulledDigests } from '#core/pulledDigestValidation.ts'
import type { Validation } from '#core/validation.ts'

/**
 * Validates the body of POST /api/checks: 1 to MAX_CHECK_FINDINGS positive integer ids, repeated
 * ids collapse into the first.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @returns {Validation<CheckCreateRequest>} - Distinct ids in request order, or the errors
 */
export const validateCheckCreate = (
  raw: Record<string, unknown>,
): Validation<CheckCreateRequest> => {
  const ids = raw.findingIds

  if (ids === undefined) {
    return { ok: false, errors: [{ field: 'findingIds', code: 'required' }] }
  }

  if (!Array.isArray(ids) || !ids.every((id) => Number.isSafeInteger(id) && id > 0)) {
    return { ok: false, errors: [{ field: 'findingIds', code: 'invalid' }] }
  }

  const findingIds = [...new Set(ids as number[])]

  if (findingIds.length === 0) {
    return { ok: false, errors: [{ field: 'findingIds', code: 'required' }] }
  }

  if (findingIds.length > MAX_CHECK_FINDINGS) {
    return { ok: false, errors: [{ field: 'findingIds', code: 'too_many' }] }
  }

  return { ok: true, value: { findingIds } }
}

/**
 * Validates the body of a worker heartbeat.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @returns {Validation<WorkerHeartbeat>} - Phase, or the errors
 */
export const validateHeartbeat = (raw: Record<string, unknown>): Validation<WorkerHeartbeat> =>
  (CHECK_PHASES as readonly unknown[]).includes(raw.phase)
    ? { ok: true, value: { phase: raw.phase as CheckPhase } }
    : {
        ok: false,
        errors: [{ field: 'phase', code: raw.phase === undefined ? 'required' : 'invalid' }],
      }

/**
 * Reads an optional text of a worker result: null, or a string cut to max characters, blank
 * text counting as null.
 * @param {unknown} value - Raw value
 * @param {string} field - Field name for the error
 * @param {number} max - Longest kept text
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string | null} - Text, null when absent or invalid
 */
const readOptionalText = (
  value: unknown,
  field: string,
  max: number,
  errors: ValidationIssue[],
): string | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string') {
    errors.push({ field, code: 'invalid' })
    return null
  }

  return value.trim() === '' ? null : capText(value.trim(), max)
}

/**
 * Validates the body of a worker result. Error and reply are cut to their limits instead of
 * refused, so an overlong reply never leaves the check running until it times out. A source is
 * kept only when present, so a result of an older worker reads as before.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @returns {Validation<WorkerResult>} - Result, or the errors
 */
export const validateWorkerResult = (raw: Record<string, unknown>): Validation<WorkerResult> => {
  const errors: ValidationIssue[] = []
  const status = raw.status === 'done' || raw.status === 'failed' ? raw.status : null
  const error = readOptionalText(raw.error, 'error', MAX_CHECK_ERROR_LENGTH, errors)
  const reply = readOptionalText(raw.reply, 'reply', MAX_CHECK_REPLY_LENGTH, errors)
  const usage = readCheckUsage(raw.usage, errors)
  const pulled = readPulledDigests(raw, errors)
  const source = readCheckedSource(raw.source, errors)
  const durationMs = raw.durationMs

  if (status === null) {
    errors.push({ field: 'status', code: raw.status === undefined ? 'required' : 'invalid' })
  }

  if (!Number.isSafeInteger(durationMs) || (durationMs as number) < 0) {
    errors.push({ field: 'durationMs', code: durationMs === undefined ? 'required' : 'invalid' })
  }

  if (errors.length > 0 || status === null) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      status,
      error:
        status === 'failed' ? (error ?? 'The worker reported a failure without a reason.') : null,
      durationMs: durationMs as number,
      usage,
      reply,
      ...pulled,
      ...(source === undefined ? {} : { source }),
    },
  }
}
