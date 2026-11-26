import type { Context } from 'hono'

import type {
  ErrorBody,
  ProposalClosedBody,
  ProposalConflictBody,
  ValidationErrorBody,
  ValidationIssue,
} from '#core/apiTypes.ts'
import type { DecisionCommandError } from '#server/db/decisionCommandResult.ts'
import type { ProposalCommandError, ProposalRefusal } from '#server/db/proposalCommandResult.ts'

type CommandRefusal = Omit<ProposalRefusal, 'ok' | 'error'> & {
  error: DecisionCommandError | ProposalCommandError
  decisionId?: number
}

/**
 * Answers 400 with the validation errors.
 * @param {Context} c - Request context
 * @param {ValidationIssue[]} errors - Problems of the input
 * @returns {Response} - Response
 */
export const validationFailed = (c: Context, errors: ValidationIssue[]): Response =>
  c.json<ValidationErrorBody>({ error: 'validation', errors }, 400)

/**
 * Answers 404.
 * @param {Context} c - Request context
 * @returns {Response} - Response
 */
export const notFound = (c: Context): Response => c.json<ErrorBody>({ error: 'not_found' }, 404)

/**
 * Answers a refused decision or proposal command: 404 for an unknown decision or proposal, 409
 * for a revoked or conflicting decision with its id, for a proposal that is no longer open with
 * its state, for an accept whose expected decisions changed with the current ids and for a
 * proposer at the open cap, 400 for a vuln_id or image without a finding and for a justification
 * on a decision whose status is not not_affected.
 * @param {Context} c - Request context
 * @param {CommandRefusal} result - Refusal
 * @param {string} findingField - Field reported for unknown_finding
 * @returns {Response} - Response
 */
export const commandRefused = (
  c: Context,
  result: CommandRefusal,
  findingField = 'vulnId',
): Response => {
  switch (result.error) {
    case 'not_found': {
      return notFound(c)
    }
    case 'unknown_finding': {
      return validationFailed(c, [{ field: findingField, code: 'unknown_finding' }])
    }
    case 'justification_not_allowed': {
      return validationFailed(c, [{ field: 'justification', code: 'not_allowed' }])
    }
    case 'revoked':
    case 'conflict': {
      return c.json<ErrorBody>({ error: result.error, decisionId: result.decisionId }, 409)
    }
    case 'proposal_closed': {
      return c.json<ProposalClosedBody>({ error: result.error, state: result.state ?? 'open' }, 409)
    }
    case 'proposal_conflict': {
      return c.json<ProposalConflictBody>(
        { error: result.error, currentDecisionIds: result.currentDecisionIds ?? [] },
        409,
      )
    }
    case 'too_many_proposals': {
      return c.json<ErrorBody>({ error: result.error }, 409)
    }
  }
}
