import type { Hono } from 'hono'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { AccessTestResult } from '#core/privateAccess.ts'
import { createCredential, updateCredential } from '#server/credentials/credentialCommands.ts'
import type { CredentialContext } from '#server/credentials/credentialContext.ts'
import type { CredentialTestGate } from '#server/credentials/credentialTestGate.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { collides, createRefusal, needsRetest } from '#server/credentials/credentialWriteChecks.ts'
import { getCredentialRow } from '#server/db/credentialRepository.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { readCandidate } from '#server/http/credentialRequests.ts'
import { commandAnswer, saveRefused } from '#server/http/credentialResponses.ts'
import { requireActor } from '#server/http/identity.ts'
import { parseId } from '#server/http/pathParams.ts'
import { readObjectBody } from '#server/http/requestBody.ts'
import { notFound } from '#server/http/responses.ts'

/**
 * Adds POST / and PATCH /:id: both validate, refuse what the store would refuse anyway, then
 * test the entered values and store them only when the test lets them through, with the test
 * as lastTest. A refused test answers 422 and writes nothing, no row and no log line. A change
 * of the label alone keeps the last test and runs none.
 * @param {Hono<AppEnv>} routes - Credential routes
 * @param {CredentialContext} context - Database, clock and logger
 * @param {{ vault: CredentialVault; tests: CredentialTestGate }} parts - Vault and test gate
 * @returns {void}
 */
export const registerCredentialWrites = (
  routes: Hono<AppEnv>,
  context: CredentialContext,
  { vault, tests }: { vault: CredentialVault; tests: CredentialTestGate },
): void => {
  const { db, clock } = context

  routes.post('/', async (c) => {
    const actor = requireActor(c)
    const read = readCandidate(c, vault, null, await readObjectBody(c))

    if (!read.ok) {
      return read.response
    }

    const refusal = createRefusal(db, read.value.write.fields)

    if (refusal !== null) {
      return c.json<ErrorBody>({ error: refusal }, 409)
    }

    const gate = await tests.beforeStore(actor, read.value.candidate, read.value.confirmUntested)

    if (!gate.ok) {
      return saveRefused(c, gate)
    }

    const result = createCredential(
      db,
      vault,
      { write: read.value.write, actor, lastTest: gate.result },
      clock(),
    )

    tests.stored(actor)
    return commandAnswer(c, context, result, { change: 'created', status: 201 })
  })

  routes.patch('/:id', async (c) => {
    const actor = requireActor(c)
    const id = parseId(c.req.param('id'))
    const row = id === null ? null : getCredentialRow(db, id)
    const body = await readObjectBody(c)

    if (row === null) {
      return notFound(c)
    }

    const read = readCandidate(c, vault, row, body)

    if (!read.ok) {
      return read.response
    }

    if (collides(db, read.value.write.fields, row.id)) {
      return c.json<ErrorBody>({ error: 'duplicate_scope' }, 409)
    }

    let lastTest: AccessTestResult | undefined

    if (needsRetest(row, read.value.write)) {
      const gate = await tests.beforeStore(actor, read.value.candidate, read.value.confirmUntested)

      if (!gate.ok) {
        return saveRefused(c, gate)
      }

      lastTest = gate.result
    }

    const result = updateCredential(
      db,
      vault,
      { id: row.id, write: read.value.write, lastTest },
      clock(),
    )

    tests.stored(actor)
    return commandAnswer(c, context, result, { change: 'updated', status: 200 })
  })
}
