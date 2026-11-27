import type { Context } from 'hono'
import { Hono } from 'hono'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { WorkerClaim } from '#core/check.ts'
import { validateHeartbeat, validateWorkerResult } from '#core/checkValidation.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import { claimForWorker, recordHeartbeat, recordResult } from '#server/checks/workerCommands.ts'
import type { WorkerUpdate } from '#server/checks/workerCommands.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { parseId } from '#server/http/pathParams.ts'
import { readValidBody } from '#server/http/requestBody.ts'
import { notFound } from '#server/http/responses.ts'

/**
 * Answers a heartbeat or result update: 204, 404 for an unknown check, 409 once it ended.
 * @param {Context<AppEnv>} c - Request context
 * @param {WorkerUpdate} update - Outcome of the update
 * @returns {Response} - Response
 */
const updateAnswer = (c: Context<AppEnv>, update: WorkerUpdate): Response => {
  if (update === 'not_found') {
    return notFound(c)
  }

  if (update === 'not_running') {
    return c.json<ErrorBody>({ error: 'check_not_running' }, 409)
  }

  return c.body(null, 204)
}

/**
 * Creates the worker routes behind the worker secret: POST /claim hands out the next check or
 * answers 204, POST /checks/:id/heartbeat keeps a running check alive, POST /checks/:id/result
 * ends it. Heartbeats and results of an ended check answer 409, which tells the worker to stop.
 * @param {CheckContext} context - Check context shared with the client routes
 * @returns {Hono<AppEnv>} - Routes, mounted at /worker
 */
export const createWorkerRoutes = (context: CheckContext): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.post('/claim', (c) => {
    const claim = claimForWorker(context)

    c.header('Cache-Control', 'no-store')
    return claim === null ? c.body(null, 204) : c.json<WorkerClaim>(claim)
  })

  routes.post('/checks/:id/heartbeat', async (c) => {
    const id = parseId(c.req.param('id'))
    const input = await readValidBody(c, validateHeartbeat)

    if (!input.ok) {
      return input.response
    }

    return updateAnswer(
      c,
      id === null ? 'not_found' : recordHeartbeat(context, id, input.value.phase),
    )
  })

  routes.post('/checks/:id/result', async (c) => {
    const id = parseId(c.req.param('id'))
    const input = await readValidBody(c, validateWorkerResult)

    if (!input.ok) {
      return input.response
    }

    return updateAnswer(c, id === null ? 'not_found' : recordResult(context, id, input.value))
  })

  return routes
}
