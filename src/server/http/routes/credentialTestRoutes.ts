import type { Hono } from 'hono'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { AccessCredentialView, AccessTestResult } from '#core/privateAccess.ts'
import type { CredentialContext } from '#server/credentials/credentialContext.ts'
import { credentialLogLine, testSummary } from '#server/credentials/credentialLogLine.ts'
import { secretReadable } from '#server/credentials/credentialSecrets.ts'
import type { CredentialTestGate } from '#server/credentials/credentialTestGate.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { testCredential } from '#server/credentials/testCredential.ts'
import type { TestThrottle } from '#server/credentials/testThrottle.ts'
import { getCredentialRow } from '#server/db/credentialRepository.ts'
import { toCredentialView } from '#server/db/credentialRows.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { readCandidate } from '#server/http/credentialRequests.ts'
import { testThrottled } from '#server/http/credentialResponses.ts'
import { requireActor } from '#server/http/identity.ts'
import { parseId } from '#server/http/pathParams.ts'
import { readObjectBody } from '#server/http/requestBody.ts'
import { notFound, validationFailed } from '#server/http/responses.ts'

/** The parts the test routes share with the other credential routes */
interface TestRouteParts {
  vault: CredentialVault
  throttle: TestThrottle
  tests: CredentialTestGate
}

/**
 * Adds POST /test, which tests entered values without storing anything, a stored credential's
 * changes when the body names its id, with the stored secret unless a new one is given, and
 * POST /:id/test, which tests a stored credential and stores the outcome as its last test.
 * @param {Hono<AppEnv>} routes - Credential routes
 * @param {CredentialContext} context - Database, clock and logger
 * @param {TestRouteParts} parts - Vault, throttle and test gate
 * @returns {void}
 */
export const registerCredentialTests = (
  routes: Hono<AppEnv>,
  context: CredentialContext,
  { vault, throttle, tests }: TestRouteParts,
): void => {
  const { db } = context

  routes.post('/test', async (c) => {
    const body = await readObjectBody(c)
    const id = body?.id

    if (id !== undefined && !(Number.isSafeInteger(id) && (id as number) > 0)) {
      return validationFailed(c, [{ field: 'id', code: 'invalid' }])
    }

    const row = id === undefined ? null : getCredentialRow(db, id as number)

    if (id !== undefined && row === null) {
      return notFound(c)
    }

    const read = readCandidate(c, vault, row, body)

    if (!read.ok) {
      return read.response
    }

    const tested = await tests.dryRun(requireActor(c), read.value.candidate)

    return tested.ok ? c.json<AccessTestResult>(tested.result) : testThrottled(c, tested.throttled)
  })

  routes.post('/:id/test', async (c) => {
    const id = parseId(c.req.param('id'))

    if (id === null || getCredentialRow(db, id) === null) {
      return notFound(c)
    }

    const refusal = throttle.start(id)

    if (refusal !== null) {
      return testThrottled(c, refusal)
    }

    const result = await testCredential(context, vault, id).catch((error: unknown) => {
      throttle.end(id, true)
      throw error
    })

    throttle.end(id, result.ok)

    if (!result.ok && result.error === 'not_found') {
      return notFound(c)
    }

    if (!result.ok) {
      return c.json<ErrorBody>({ error: result.error }, 409)
    }

    const view = toCredentialView(result.row, secretReadable(vault, result.row))

    context.log(
      `${credentialLogLine('tested', result.row, requireActor(c))} ${testSummary(view.lastTest)}`,
    )
    return c.json<AccessCredentialView>(view)
  })
}
