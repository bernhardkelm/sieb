import {
  UPSTREAM_STATUS,
  WAITING_FOR_MAX_LENGTH,
  type Decision,
  type DecisionPatch,
  type DecisionStatus,
} from '#core/decision.ts'
import { nonBlank } from '#core/decisionFieldReaders.ts'
import type { DecisionInputError } from '#core/decisionInputError.ts'

/** Whether a decision waits for upstream and what for */
export type UpstreamFields = Pick<Decision, 'upstreamPending' | 'waitingFor'>

/** Final values of a decision the upstream rules check */
export type UpstreamSubject = UpstreamFields & Pick<Decision, 'status' | 'expiresAt'>

/**
 * Reads upstreamPending: absent stays undefined, otherwise a boolean.
 * @param {unknown} value - Raw value
 * @param {DecisionInputError[]} errors - Collected errors, appended to
 * @returns {boolean | undefined} - Flag, undefined when absent or invalid
 */
const readUpstreamPending = (value: unknown, errors: DecisionInputError[]): boolean | undefined => {
  if (value === undefined || typeof value === 'boolean') {
    return value
  }

  errors.push({ field: 'upstreamPending', code: 'invalid' })
  return undefined
}

/**
 * Reads waitingFor: absent stays undefined, null or blank means none, otherwise trimmed text of
 * at most WAITING_FOR_MAX_LENGTH characters.
 * @param {unknown} value - Raw value
 * @param {DecisionInputError[]} errors - Collected errors, appended to
 * @returns {string | null | undefined} - Text, undefined when absent or invalid
 */
const readWaitingFor = (
  value: unknown,
  errors: DecisionInputError[],
): string | null | undefined => {
  if (value === undefined || value === null) {
    return value
  }

  if (typeof value !== 'string') {
    errors.push({ field: 'waitingFor', code: 'invalid' })
    return undefined
  }

  const text = nonBlank(value)

  if (text !== null && text.length > WAITING_FOR_MAX_LENGTH) {
    errors.push({ field: 'waitingFor', code: 'too_long' })
    return undefined
  }

  return text
}

/**
 * Returns the first upstream rule the final values of a decision break: upstreamPending only
 * with fix_planned and then with waitingFor and an expiry, waitingFor only with upstreamPending.
 * @param {UpstreamSubject} subject - Status, expiry and upstream fields after the write
 * @returns {DecisionInputError | null} - Broken rule, null when they hold
 */
export const upstreamIssue = (subject: UpstreamSubject): DecisionInputError | null => {
  if (subject.upstreamPending && subject.status !== UPSTREAM_STATUS) {
    return { field: 'upstreamPending', code: 'not_allowed' }
  }

  if (!subject.upstreamPending) {
    return subject.waitingFor === null ? null : { field: 'waitingFor', code: 'not_allowed' }
  }

  if (subject.waitingFor === null) {
    return { field: 'waitingFor', code: 'required' }
  }

  return subject.expiresAt === null ? { field: 'expiresAt', code: 'required' } : null
}

/**
 * Reads the upstream fields of a new decision, an absent upstreamPending meaning false, and
 * checks them against its status and expiry unless they are invalid themselves.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @param {DecisionStatus | null} status - Validated status, null skips the rules
 * @param {string | null | undefined} expiresAt - Expiry the decision gets
 * @param {DecisionInputError[]} errors - Collected errors, appended to
 * @returns {UpstreamFields} - Upstream fields
 */
export const readUpstreamInput = (
  raw: Record<string, unknown>,
  status: DecisionStatus | null,
  expiresAt: string | null | undefined,
  errors: DecisionInputError[],
): UpstreamFields => {
  const before = errors.length
  const fields: UpstreamFields = {
    upstreamPending: readUpstreamPending(raw.upstreamPending, errors) ?? false,
    waitingFor: readWaitingFor(raw.waitingFor, errors) ?? null,
  }
  const issue =
    status === null || expiresAt === undefined || errors.length > before
      ? null
      : upstreamIssue({ ...fields, status, expiresAt })

  if (issue !== null) {
    errors.push(issue)
  }

  return fields
}

/**
 * Reads the upstream fields of a decision change, each present one only; the rules need the
 * stored decision and are checked by mergeUpstream.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @param {DecisionInputError[]} errors - Collected errors, appended to
 * @returns {Pick<DecisionPatch, 'upstreamPending' | 'waitingFor'>} - Present fields
 */
export const readUpstreamPatch = (
  raw: Record<string, unknown>,
  errors: DecisionInputError[],
): Pick<DecisionPatch, 'upstreamPending' | 'waitingFor'> => {
  const upstreamPending = readUpstreamPending(raw.upstreamPending, errors)
  const waitingFor = readWaitingFor(raw.waitingFor, errors)

  return {
    ...(upstreamPending === undefined ? {} : { upstreamPending }),
    ...(waitingFor === undefined ? {} : { waitingFor }),
  }
}

/**
 * Merges a change over the upstream fields of a stored decision: a status leaving fix_planned
 * clears them unless the change sets them, absent fields keep the stored values.
 * @param {UpstreamFields} before - Stored decision
 * @param {DecisionPatch} patch - Validated change
 * @param {Pick<Decision, 'status' | 'expiresAt'>} after - Status and expiry after the change
 * @returns {{ ok: true; value: UpstreamFields } | { ok: false; issue: DecisionInputError }} - Merged fields or the broken rule
 */
export const mergeUpstream = (
  before: UpstreamFields,
  patch: DecisionPatch,
  after: Pick<Decision, 'status' | 'expiresAt'>,
): { ok: true; value: UpstreamFields } | { ok: false; issue: DecisionInputError } => {
  const upstreamPending =
    patch.upstreamPending ?? (after.status === UPSTREAM_STATUS && before.upstreamPending)
  const waitingFor =
    patch.waitingFor !== undefined ? patch.waitingFor : upstreamPending ? before.waitingFor : null
  const value = { upstreamPending, waitingFor }
  const issue = upstreamIssue({ ...value, status: after.status, expiresAt: after.expiresAt })

  return issue === null ? { ok: true, value } : { ok: false, issue }
}
