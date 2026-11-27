import type { ValidationIssue } from '#core/errorApiTypes.ts'
import { readExpectedDecisionIds } from '#core/expectedDecisionIds.ts'
import { isPlainObject } from '#core/isPlainObject.ts'
import { PROPOSAL_LIMITS } from '#core/proposal.ts'
import {
  MAX_BULK_PROPOSALS,
  type BulkAcceptItem,
  type BulkAcceptRequest,
  type BulkRejectRequest,
} from '#core/proposalBulk.ts'
import { readProposalText } from '#core/proposalTextReaders.ts'
import type { Validation } from '#core/validation.ts'

/**
 * Returns whether a value is a proposal id, a positive safe integer.
 * @param {unknown} value - Raw value
 * @returns {boolean} - True for an id
 */
const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/**
 * Checks the list of a bulk body: an array of 1 to MAX_BULK_PROPOSALS entries.
 * @param {unknown} value - Raw list
 * @param {string} field - Field name for the error
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {value is unknown[]} - True for a list of an allowed length
 */
const isBatch = (value: unknown, field: string, errors: ValidationIssue[]): value is unknown[] => {
  if (Array.isArray(value) && value.length > MAX_BULK_PROPOSALS) {
    errors.push({ field, code: 'too_many' })
    return false
  }

  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ field, code: value === undefined ? 'required' : 'invalid' })
    return false
  }

  return true
}

/**
 * Returns whether a list of ids holds an id twice.
 * @param {readonly number[]} ids - Ids
 * @returns {boolean} - True with a duplicate
 */
const hasDuplicates = (ids: readonly number[]): boolean => new Set(ids).size !== ids.length

/**
 * Reads one entry of a bulk accept: a proposal id and the decisions the reviewer saw.
 * @param {unknown} value - Raw entry
 * @param {number} index - Position, for the error field
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {BulkAcceptItem | null} - Entry, null when malformed
 */
const readAcceptItem = (
  value: unknown,
  index: number,
  errors: ValidationIssue[],
): BulkAcceptItem | null => {
  if (!isPlainObject(value) || !isId(value.id)) {
    errors.push({ field: `items[${index}].id`, code: 'invalid' })
    return null
  }

  const issues: ValidationIssue[] = []
  const expectedDecisionIds = readExpectedDecisionIds(value.expectedDecisionIds, issues)

  errors.push(...issues.map((issue) => ({ ...issue, field: `items[${index}].${issue.field}` })))
  return expectedDecisionIds === null ? null : { id: value.id, expectedDecisionIds }
}

/**
 * Validates a bulk accept: 1 to MAX_BULK_PROPOSALS distinct proposals, each with its
 * expectedDecisionIds as the single accept takes them. Edits are not part of a bulk accept.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @returns {Validation<BulkAcceptRequest>} - Entries or the errors
 */
export const validateBulkAccept = (raw: Record<string, unknown>): Validation<BulkAcceptRequest> => {
  const errors: ValidationIssue[] = []

  if (!isBatch(raw.items, 'items', errors)) {
    return { ok: false, errors }
  }

  const items = raw.items.map((value, index) => readAcceptItem(value, index, errors))

  if (errors.length === 0 && hasDuplicates(items.map((item) => item?.id ?? 0))) {
    errors.push({ field: 'items', code: 'duplicate' })
  }

  return errors.length === 0
    ? { ok: true, value: { items: items.filter((item) => item !== null) } }
    : { ok: false, errors }
}

/**
 * Validates a bulk reject: 1 to MAX_BULK_PROPOSALS distinct proposal ids and one reason for all,
 * with the rules of the single reject.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @returns {Validation<BulkRejectRequest>} - Ids and reason or the errors
 */
export const validateBulkReject = (raw: Record<string, unknown>): Validation<BulkRejectRequest> => {
  const errors: ValidationIssue[] = []
  const reason = readProposalText(
    raw.reason,
    'reason',
    { max: PROPOSAL_LIMITS.rejectReason, multiline: true, required: true },
    errors,
  )

  if (isBatch(raw.ids, 'ids', errors)) {
    if (!raw.ids.every(isId)) {
      errors.push({ field: 'ids', code: 'invalid' })
    } else if (hasDuplicates(raw.ids)) {
      errors.push({ field: 'ids', code: 'duplicate' })
    }
  }

  return errors.length === 0 && reason !== null && Array.isArray(raw.ids)
    ? { ok: true, value: { ids: raw.ids as number[], reason } }
    : { ok: false, errors }
}
