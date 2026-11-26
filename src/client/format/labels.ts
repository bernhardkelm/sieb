import type { DecisionJustification, DecisionScope, DecisionStatus } from '#core/decision.ts'
import type { DecisionEventType } from '#core/decisionEvent.ts'
import type { DecisionState, ReopenReason } from '#core/effectiveDecision.ts'
import type { Exposure } from '#core/exposure.ts'
import { SELF_OWNER } from '#core/owner.ts'

export const STATUS_LABELS: Record<DecisionStatus, string> = {
  not_affected: 'Not affected',
  accepted: 'Accepted',
  fix_planned: 'Fix planned',
}

export const JUSTIFICATION_LABELS: Record<DecisionJustification, string> = {
  component_not_present: 'Component not present (false positive)',
  vulnerable_code_not_present: 'Vulnerable code not present',
  vulnerable_code_not_in_execute_path: 'Vulnerable code not in execute path',
  vulnerable_code_cannot_be_controlled_by_adversary: 'Cannot be controlled by an adversary',
  inline_mitigations_already_exist: 'Mitigated',
}

export const STATE_LABELS: Record<DecisionState, string> = {
  active: 'Active',
  fix_planned: 'Fix planned',
  expired: 'Expired',
  revoked: 'Revoked',
  reopened: 'Re-opened',
}

export const SCOPE_LABELS: Record<DecisionScope, string> = {
  image: 'This image',
  all: 'All images',
}

export const EXPOSURE_LABELS: Record<Exposure, string> = {
  public: 'Public',
  gated: 'Gated',
  internal: 'Internal',
}

/**
 * Returns the display label of a free-form owner, "Own" for self.
 * @param {string} owner - Owner label
 * @returns {string} - Label
 */
export const ownerLabel = (owner: string): string => (owner === SELF_OWNER ? 'Own' : owner)

export const REOPEN_LABELS: Record<ReopenReason, string> = {
  severity_rose: 'Severity rose',
  kev_listed: 'Listed in KEV',
}

export const EVENT_LABELS: Record<DecisionEventType, string> = {
  created: 'Decided',
  updated: 'Changed',
  revoked: 'Revoked',
  expired: 'Expired',
  reopened: 'Re-opened',
}

const ERROR_MESSAGES: Record<string, string> = {
  required: 'Required.',
  invalid: 'Not a valid value.',
  in_past: 'Must lie in the future.',
  too_far: 'Must lie within three years.',
  too_long: 'At most 2000 characters.',
  too_many: 'At most 200 images at once.',
  not_allowed: 'Not allowed here.',
  empty_patch: 'Nothing changed.',
  conflict: 'A decision for this scope exists already, edit that one instead.',
  revoked: 'This decision was revoked in the meantime.',
  not_found: 'This decision or finding no longer exists.',
  unknown_finding: 'No open finding matches this decision.',
  unauthorized: 'You are not signed in.',
  unsupported_media_type: 'The server refused the request format, reload the page.',
  cross_site_request: 'The server refused a request from another site.',
  forbidden_host: 'The server does not accept requests for this host name.',
  payload_too_large: 'The request is too large.',
}

/**
 * Returns the readable message of a known API error code.
 * @param {string} code - Error or validation code
 * @returns {string | null} - Message, null for unknown codes
 */
export const knownErrorMessage = (code: string): string | null => ERROR_MESSAGES[code] ?? null

/**
 * Returns a readable message for an API error code.
 * @param {string} code - Error or validation code
 * @returns {string} - Message, a generic one for unknown codes
 */
export const errorCodeMessage = (code: string): string =>
  knownErrorMessage(code) ?? 'The server rejected the request.'
