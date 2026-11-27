import type { Context } from 'hono'

import type { AccessTestRefusal } from '#core/accessTestVerdict.ts'
import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { AccessCredentialView } from '#core/privateAccess.ts'
import type { CredentialCommandResult } from '#server/credentials/credentialCommands.ts'
import type { CredentialContext } from '#server/credentials/credentialContext.ts'
import { credentialLogLine } from '#server/credentials/credentialLogLine.ts'
import { secretReadable } from '#server/credentials/credentialSecrets.ts'
import type { RefusedSave, ThrottledTest } from '#server/credentials/credentialTestGate.ts'
import { TEST_COOLDOWN_MS, type TestRefusal } from '#server/credentials/testThrottle.ts'
import { toCredentialView, type CredentialRow } from '#server/db/credentialRows.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { notFound } from '#server/http/responses.ts'

/**
 * Returns the request fields of a stored credential, the base a PATCH body is merged over.
 * @param {CredentialRow} row - Stored credential
 * @returns {Record<string, unknown>} - Fields without the secret
 */
export const inputOf = (row: CredentialRow): Record<string, unknown> => {
  const { provider, label, uses, registryHost, gitHost, pathPrefix, repoMapping, username } =
    toCredentialView(row, false)

  return { provider, label, uses, registryHost, gitHost, pathPrefix, repoMapping, username }
}

/**
 * Answers a credential command: the view, 404 for an unknown id, 409 for the other refusals.
 * @param {Context<AppEnv>} c - Request context
 * @param {CredentialContext} context - Credential context
 * @param {CredentialCommandResult} result - Outcome
 * @param {{ change: string; status: 200 | 201 }} answer - Log word and success status
 * @returns {Response} - Response
 */
export const commandAnswer = (
  c: Context<AppEnv>,
  context: CredentialContext,
  result: CredentialCommandResult,
  { change, status }: { change: string; status: 200 | 201 },
): Response => {
  if (!result.ok) {
    return result.error === 'not_found'
      ? notFound(c)
      : c.json<ErrorBody>({ error: result.error }, 409)
  }

  context.log(credentialLogLine(change, result.row, requireActor(c)))
  return c.json<AccessCredentialView>(
    toCredentialView(result.row, secretReadable(context.vault, result.row)),
    status,
  )
}

/**
 * Answers a test the throttle did not start: 429 with Retry-After.
 * @param {Context<AppEnv>} c - Request context
 * @param {TestRefusal} refusal - test_cooldown or tests_busy
 * @returns {Response} - Response
 */
export const testThrottled = (c: Context<AppEnv>, refusal: TestRefusal): Response => {
  c.header('Retry-After', String(Math.ceil(TEST_COOLDOWN_MS / 1000)))
  return c.json<ErrorBody>({ error: refusal }, 429)
}

/**
 * Answers a save the test did not let through: 429 when the test could not start, else 422
 * with the verdict as error and the result, which never carries the secret.
 * @param {Context<AppEnv>} c - Request context
 * @param {ThrottledTest | RefusedSave} outcome - Refusal of the gate
 * @returns {Response} - Response
 */
export const saveRefused = (c: Context<AppEnv>, outcome: ThrottledTest | RefusedSave): Response =>
  'throttled' in outcome
    ? testThrottled(c, outcome.throttled)
    : c.json<AccessTestRefusal>({ error: outcome.refused, result: outcome.result }, 422)
