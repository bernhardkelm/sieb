import { Hono } from 'hono'

import type { BulkDecisionResult } from '#core/apiTypes.ts'
import { validateBulkDecisionInput } from '#core/bulkDecisionValidation.ts'
import { createBulkDecisions } from '#server/db/createBulkDecisions.ts'
import { listDecisionViewsByVuln } from '#server/db/findingViews.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { INVALID_BODY, readObjectBody } from '#server/http/requestBody.ts'
import { validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

/**
 * Creates the bulk decision route: POST / creates image-scoped decisions of one vuln_id for a
 * list of images or all-open in one transaction and reports images with an existing decision as
 * skipped with the reason decided, expired or reopened.
 * @param {RouteDeps} deps - Database and clock
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/decisions/bulk
 */
export const createBulkDecisionRoutes = ({ db, clock }: RouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.post('/', async (c) => {
    const body = await readObjectBody(c)
    const now = clock()
    const input = body === null ? null : validateBulkDecisionInput(body, now)

    if (input === null || !input.ok) {
      return validationFailed(c, input?.errors ?? INVALID_BODY)
    }

    const outcome = createBulkDecisions(db, input.value, requireActor(c), now)
    const createdIds = new Set(outcome.created.map((decision) => decision.id))
    const views = listDecisionViewsByVuln(db, input.value.vulnId, clock())

    return c.json<BulkDecisionResult>({
      created: views.filter((view) => createdIds.has(view.decision.id)).reverse(),
      skipped: outcome.skipped,
    })
  })

  return routes
}
