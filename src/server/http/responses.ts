import type { Context } from 'hono'

import type { ErrorBody, ValidationErrorBody, ValidationIssue } from '#core/apiTypes.ts'
import type { DecisionCommandError } from '#server/db/decisionCommandResult.ts'

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
 * Answers a refused decision command: 404 for an unknown decision, 409 for a revoked or
 * conflicting one with its id, 400 for a vuln_id or image without a finding.
 * @param {Context} c - Request context
 * @param {{ error: DecisionCommandError; decisionId?: number }} result - Refusal
 * @param {string} findingField - Field reported for unknown_finding
 * @returns {Response} - Response
 */
export const commandRefused = (
  c: Context,
  result: { error: DecisionCommandError; decisionId?: number },
  findingField = 'vulnId',
): Response => {
  switch (result.error) {
    case 'not_found': {
      return notFound(c)
    }
    case 'unknown_finding': {
      return validationFailed(c, [{ field: findingField, code: 'unknown_finding' }])
    }
    case 'revoked':
    case 'conflict': {
      return c.json<ErrorBody>({ error: result.error, decisionId: result.decisionId }, 409)
    }
  }
}
