import { Hono } from 'hono'

import { validateCredentialInput } from '#core/credentialInputValidation.ts'
import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { AccessCredentialsResponse, AccessCredentialView } from '#core/privateAccess.ts'
import type { CredentialContext } from '#server/credentials/credentialContext.ts'
import {
  createCredential,
  deleteCredential,
  secretReadable,
  updateCredential,
} from '#server/credentials/credentialCommands.ts'
import { credentialLogLine, testSummary } from '#server/credentials/credentialLogLine.ts'
import { testCredential } from '#server/credentials/testCredential.ts'
import { createTestThrottle, TEST_COOLDOWN_MS } from '#server/credentials/testThrottle.ts'
import { getCredentialRow, listCredentialRows } from '#server/db/credentialRepository.ts'
import { toCredentialView } from '#server/db/credentialRows.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { commandAnswer, inputOf } from '#server/http/credentialResponses.ts'
import { requireActor } from '#server/http/identity.ts'
import { noStore } from '#server/http/noStore.ts'
import { parseId } from '#server/http/pathParams.ts'
import { INVALID_BODY, readObjectBody, readValidBody } from '#server/http/requestBody.ts'
import { notFound, validationFailed } from '#server/http/responses.ts'

/** What the app factory passes to the credential routes besides database, clock and logger */
export type CredentialSetup = Pick<CredentialContext, 'vault' | 'fetch' | 'timings' | 'testLimits'>

/**
 * Creates the access credential routes for signed-in users: GET / lists them, POST / stores
 * one, PATCH /:id changes one (the secret only to replace it), DELETE /:id deletes one and
 * POST /:id/test tests one against what it covers, throttled per credential and overall (429
 * test_cooldown or tests_busy). No answer ever carries a secret.
 * Without SIEB_CREDENTIALS_KEY the list is empty and every write answers 404 credentials_disabled.
 * @param {CredentialContext} context - Database, clock, logger, vault, fetcher state and fetch
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/credentials
 */
export const createCredentialRoutes = (context: CredentialContext): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()
  const { db, clock, vault } = context
  const throttle = createTestThrottle(() => clock().getTime(), context.testLimits)

  routes.use('*', async (c, next) => {
    if (c.get('actor') === null) {
      return c.json<ErrorBody>({ error: 'unauthorized' }, 401)
    }

    await next()
  })
  routes.use('*', noStore())

  routes.get('/', (c) =>
    c.json<AccessCredentialsResponse>({
      enabled: vault !== null,
      fetcherConfigured: context.fetcherConfigured,
      credentials:
        vault === null
          ? []
          : listCredentialRows(db).map((row) => toCredentialView(row, secretReadable(vault, row))),
    }),
  )

  if (vault === null) {
    routes.all('*', (c) => c.json<ErrorBody>({ error: 'credentials_disabled' }, 404))
    return routes
  }

  routes.post('/', async (c) => {
    const input = await readValidBody(c, (body) => validateCredentialInput(body, true))

    if (!input.ok) {
      return input.response
    }

    const result = createCredential(
      db,
      vault,
      { write: input.value, actor: requireActor(c) },
      clock(),
    )

    return commandAnswer(c, context, result, { change: 'created', status: 201 })
  })

  routes.patch('/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    const row = id === null ? null : getCredentialRow(db, id)
    const body = await readObjectBody(c)

    if (row === null) {
      return notFound(c)
    }

    const input =
      body === null ? null : validateCredentialInput({ ...inputOf(row), ...body }, false)

    if (input === null || !input.ok) {
      return validationFailed(c, input?.errors ?? INVALID_BODY)
    }

    const result = updateCredential(db, vault, { id: row.id, write: input.value }, clock())

    return commandAnswer(c, context, result, { change: 'updated', status: 200 })
  })

  routes.delete('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    const row = id === null ? null : deleteCredential(db, id)

    if (row === null) {
      return notFound(c)
    }

    context.log(credentialLogLine('deleted', row, requireActor(c)))
    return c.body(null, 204)
  })

  routes.post('/:id/test', async (c) => {
    const id = parseId(c.req.param('id'))

    if (id === null || getCredentialRow(db, id) === null) {
      return notFound(c)
    }

    const refusal = throttle.start(id)

    if (refusal !== null) {
      c.header('Retry-After', String(Math.ceil(TEST_COOLDOWN_MS / 1000)))
      return c.json<ErrorBody>({ error: refusal }, 429)
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

  return routes
}
