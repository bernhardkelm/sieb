import { Hono } from 'hono'

import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import type { ErrorBody } from '#core/apiTypes.ts'
import { validateCheckCreate } from '#core/checkValidation.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import { DISABLED_CHECKS, readChecks } from '#server/checks/readChecks.ts'
import { cancelForUser, queueForUser } from '#server/checks/userCommands.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { parseId } from '#server/http/pathParams.ts'
import { INVALID_BODY, readObjectBody } from '#server/http/requestBody.ts'
import { notFound, validationFailed } from '#server/http/responses.ts'

/**
 * Creates the Auto-check routes of the UI: GET / answers the running check, the queue and the
 * newest ended checks, POST / queues checks of findings, DELETE /:id cancels a queued or
 * running check. Writes need the acting user, like every /api write.
 * @param {CheckContext} context - Check context shared with the worker listener
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/checks
 */
export const createCheckRoutes = (context: CheckContext): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })

  routes.get('/', (c) => c.json<ChecksResponse>(readChecks(context)))

  routes.post('/', async (c) => {
    const body = await readObjectBody(c)
    const input = body === null ? null : validateCheckCreate(body)

    if (input === null || !input.ok) {
      return validationFailed(c, input?.errors ?? INVALID_BODY)
    }

    return c.json<CheckCreateResponse>(
      queueForUser(context, requireActor(c), input.value.findingIds),
    )
  })

  routes.delete('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    const result = id === null ? 'not_found' : cancelForUser(context, requireActor(c), id)

    if (result === 'not_found') {
      return notFound(c)
    }

    if (result === 'finished') {
      return c.json<ErrorBody>({ error: 'check_finished' }, 409)
    }

    return c.body(null, 204)
  })

  return routes
}

/**
 * Creates the stand-in of the check routes while SIEB_CHECKS_ENABLED is off: GET / answers an
 * empty overview with enabled false, every other request 404 checks_disabled.
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/checks
 */
export const createChecksDisabledRoutes = (): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => c.json<ChecksResponse>(DISABLED_CHECKS))
  routes.all('*', (c) => c.json<ErrorBody>({ error: 'checks_disabled' }, 404))

  return routes
}
