import { Hono } from 'hono'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { AccessCredentialsResponse } from '#core/privateAccess.ts'
import { deleteCredential } from '#server/credentials/credentialCommands.ts'
import type { CredentialContext } from '#server/credentials/credentialContext.ts'
import { credentialLogLine } from '#server/credentials/credentialLogLine.ts'
import { secretReadable } from '#server/credentials/credentialSecrets.ts'
import { createCredentialTestGate } from '#server/credentials/credentialTestGate.ts'
import { createTestThrottle } from '#server/credentials/testThrottle.ts'
import { listCredentialRows } from '#server/db/credentialRepository.ts'
import { toCredentialView } from '#server/db/credentialRows.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { noStore } from '#server/http/noStore.ts'
import { parseId } from '#server/http/pathParams.ts'
import { notFound } from '#server/http/responses.ts'
import { registerCredentialTests } from '#server/http/routes/credentialTestRoutes.ts'
import { registerCredentialWrites } from '#server/http/routes/credentialWriteRoutes.ts'

/** What the app factory passes to the credential routes besides database, clock and logger */
export type CredentialSetup = Pick<CredentialContext, 'vault' | 'fetch' | 'timings' | 'testLimits'>

/**
 * Creates the access credential routes for signed-in users: GET / lists them, POST / and
 * PATCH /:id store and change one only after its values passed a test, DELETE /:id deletes one,
 * POST /test tests entered values without storing them and POST /:id/test tests a stored one,
 * throttled per credential, per user and overall (429 test_cooldown or tests_busy). No answer
 * ever carries a secret.
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

  const tests = createCredentialTestGate(context, vault, throttle)

  routes.delete('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    const row = id === null ? null : deleteCredential(db, id)

    if (row === null) {
      return notFound(c)
    }

    context.log(credentialLogLine('deleted', row, requireActor(c)))
    return c.body(null, 204)
  })

  registerCredentialWrites(routes, context, { vault, tests })
  registerCredentialTests(routes, context, { vault, throttle, tests })

  return routes
}
