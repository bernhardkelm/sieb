import { Hono, type Context } from 'hono'

import { MAX_REASON_LENGTH, nonBlank } from '#core/decisionFieldReaders.ts'
import { isDecisionFilter, matchesDecisionFilter } from '#core/decisionFilter.ts'
import { validateDecisionInput, validateDecisionPatch } from '#core/decisionValidation.ts'
import type { DecisionView } from '#core/findingView.ts'
import { createDecision } from '#server/db/createDecision.ts'
import type { DecisionCommandResult } from '#server/db/decisionCommandResult.ts'
import { listDecisionViews, listDecisionViewsByVuln } from '#server/db/findingViews.ts'
import { revokeDecision } from '#server/db/revokeDecision.ts'
import { updateDecision } from '#server/db/updateDecision.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { parseId } from '#server/http/pathParams.ts'
import { INVALID_BODY, readObjectBody } from '#server/http/requestBody.ts'
import { commandRefused, notFound, validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

/**
 * Creates the decision routes: GET / lists decisions with their state, ?state= filters by a
 * state or expiring; POST / creates an image-scoped or all-scope decision; PATCH /:id changes
 * status, reason or expiry and re-confirms with reconfirm true; POST /:id/revoke revokes with an
 * optional comment. Writes answer
 * the decision with its state.
 * @param {RouteDeps} deps - Database and clock
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/decisions
 */
export const createDecisionRoutes = ({ db, clock }: RouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  /**
   * Answers a decision command with the decision and its state, or the refusal.
   * @param {Context<AppEnv>} c - Request context
   * @param {DecisionCommandResult} result - Command result
   * @param {200 | 201} status - Status on success
   * @param {string} findingField - Field reported for unknown_finding
   * @returns {Response} - Response
   */
  const answer = (
    c: Context<AppEnv>,
    result: DecisionCommandResult,
    status: 200 | 201,
    findingField?: string,
  ): Response => {
    if (!result.ok) {
      return commandRefused(c, result, findingField)
    }

    const view = listDecisionViewsByVuln(db, result.decision.vulnId, clock()).find(
      (candidate) => candidate.decision.id === result.decision.id,
    )

    return view ? c.json<DecisionView>(view, status) : notFound(c)
  }

  routes.get('/', (c) => {
    const state = c.req.query('state')
    const now = clock()

    if (state !== undefined && !isDecisionFilter(state)) {
      return validationFailed(c, [{ field: 'state', code: 'invalid' }])
    }

    const views = listDecisionViews(db, now)

    return c.json<DecisionView[]>(
      state === undefined ? views : views.filter((view) => matchesDecisionFilter(view, state, now)),
    )
  })

  routes.post('/', async (c) => {
    const body = await readObjectBody(c)
    const now = clock()
    const input = body === null ? null : validateDecisionInput(body, now)

    if (input === null || !input.ok) {
      return validationFailed(c, input?.errors ?? INVALID_BODY)
    }

    const findingField = input.value.scope === 'image' ? 'imageRef' : 'vulnId'

    return answer(c, createDecision(db, input.value, requireActor(c), now), 201, findingField)
  })

  routes.patch('/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    const body = await readObjectBody(c)
    const now = clock()

    if (id === null) {
      return notFound(c)
    }

    const patch = body === null ? null : validateDecisionPatch(body, now)

    if (patch === null || !patch.ok) {
      return validationFailed(c, patch?.errors ?? INVALID_BODY)
    }

    return answer(c, updateDecision(db, id, patch.value, requireActor(c), now), 200)
  })

  routes.post('/:id/revoke', async (c) => {
    const id = parseId(c.req.param('id'))
    const body = await readObjectBody(c)

    if (id === null) {
      return notFound(c)
    }

    if (body === null || (body.comment !== undefined && typeof body.comment !== 'string')) {
      return validationFailed(c, [{ field: 'comment', code: 'invalid' }])
    }

    if (typeof body.comment === 'string' && body.comment.trim().length > MAX_REASON_LENGTH) {
      return validationFailed(c, [{ field: 'comment', code: 'too_long' }])
    }

    const comment = nonBlank(body.comment)

    return answer(c, revokeDecision(db, id, requireActor(c), clock(), comment), 200)
  })

  return routes
}
