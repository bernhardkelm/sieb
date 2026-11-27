import { Hono } from 'hono'

import type { BulkProposalResponse, BulkProposalResult } from '#core/proposalBulk.ts'
import { validateBulkAccept, validateBulkReject } from '#core/proposalBulkValidation.ts'
import { acceptUnchanged, rejectOne, type BatchStep } from '#server/db/proposalBatch.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { readValidBody } from '#server/http/requestBody.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { acceptLogLine, rejectLogLine } from '#server/proposalLogLines.ts'

export interface BulkProposalRouteDeps extends RouteDeps {
  log: (message: string) => void
}

/**
 * Runs one step of a batch, turning an unexpected failure into not_acceptable so the results
 * of the proposals before it still reach the client.
 * @param {number} id - Proposal id
 * @param {() => BatchStep<T>} step - Step, atomic on its own
 * @param {(message: string) => void} log - Logger
 * @returns {BatchStep<T>} - Step outcome
 */
const runStep = <T>(
  id: number,
  step: () => BatchStep<T>,
  log: (message: string) => void,
): BatchStep<T> => {
  try {
    return step()
  } catch (error) {
    log(`[sieb] bulk step for proposal ${id} failed: ${String(error)}`)
    return { vulnId: null, outcome: 'not_acceptable', written: null }
  }
}

/**
 * Builds the result of a step.
 * @param {number} id - Proposal id
 * @param {BatchStep<unknown>} step - Step outcome
 * @returns {BulkProposalResult} - Result
 */
const resultOf = (id: number, { vulnId, outcome }: BatchStep<unknown>): BulkProposalResult => ({
  id,
  vulnId,
  outcome,
})

/**
 * Creates the bulk proposal routes: POST /bulk-accept accepts up to MAX_BULK_PROPOSALS proposals
 * unchanged with the expected decision ids per proposal, POST /bulk-reject rejects up to as many
 * with one reason. Each proposal runs in a transaction of its own, one at a time, and comes back
 * with its outcome; outdated and inconclusive proposals are skipped, never forced. Every write
 * is logged as the single routes log it.
 * @param {BulkProposalRouteDeps} deps - Database, clock and logger
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/proposals
 */
export const createBulkProposalRoutes = ({
  db,
  clock,
  log,
}: BulkProposalRouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.post('/bulk-accept', async (c) => {
    const input = await readValidBody(c, validateBulkAccept)

    if (!input.ok) {
      return input.response
    }

    const actor = requireActor(c)
    const results = input.value.items.map((item) => {
      const step = runStep(item.id, () => acceptUnchanged(db, item, { actor, now: clock() }), log)

      if (step.written !== null) {
        log(acceptLogLine(step.written, actor))
      }

      return resultOf(item.id, step)
    })

    return c.json<BulkProposalResponse>({ results })
  })

  routes.post('/bulk-reject', async (c) => {
    const input = await readValidBody(c, validateBulkReject)

    if (!input.ok) {
      return input.response
    }

    const actor = requireActor(c)
    const { ids, reason } = input.value
    const results = ids.map((id) => {
      const step = runStep(id, () => rejectOne(db, id, reason, { actor, now: clock() }), log)

      if (step.written !== null) {
        log(rejectLogLine(step.written.proposal, actor))
      }

      return resultOf(id, step)
    })

    return c.json<BulkProposalResponse>({ results })
  })

  return routes
}
