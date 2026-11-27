import { Hono } from 'hono'

import type { ValidationIssue } from '#core/errorApiTypes.ts'
import type { ProposalAcceptResponse, ProposalRejectResponse } from '#core/proposalApiTypes.ts'
import { readExpectedDecisionIds } from '#core/expectedDecisionIds.ts'
import { PROPOSAL_LIMITS } from '#core/proposal.ts'
import { lacksReviewerStatus } from '#core/proposalAccept.ts'
import { validateAcceptEdits } from '#core/proposalAcceptEdits.ts'
import { readProposalText } from '#core/proposalTextReaders.ts'
import { toProposalView } from '#core/proposalView.ts'
import { acceptProposal } from '#server/db/acceptProposal.ts'
import { listDecisionViewsByVuln } from '#server/db/findingViews.ts'
import { getProposal } from '#server/db/proposalRepository.ts'
import { rejectProposal } from '#server/db/rejectProposal.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { parseId } from '#server/http/pathParams.ts'
import { INVALID_BODY, readObjectBody } from '#server/http/requestBody.ts'
import { commandRefused, notFound, validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { acceptLogLine, rejectLogLine } from '#server/proposalLogLines.ts'

export interface ProposalReviewRouteDeps extends RouteDeps {
  log: (message: string) => void
}

/**
 * Creates the review routes of single proposals: POST /:id/accept writes the decisions when the
 * expected decision ids still hold, with optional edits of status, justification, reason and
 * expiry, an inconclusive proposal only with the reviewer's status and reason, else 409
 * not_acceptable; POST /:id/reject closes it with a reason. Accept and reject are logged.
 * @param {ProposalReviewRouteDeps} deps - Database, clock, logger
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/proposals
 */
export const createProposalReviewRoutes = ({
  db,
  clock,
  log,
}: ProposalReviewRouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.post('/:id/accept', async (c) => {
    const id = parseId(c.req.param('id'))
    const body = await readObjectBody(c)
    const now = clock()
    const proposal = id === null ? null : getProposal(db, id)

    if (id === null || proposal === null) {
      return notFound(c)
    }

    if (body === null) {
      return validationFailed(c, INVALID_BODY)
    }

    if (proposal.state !== 'open') {
      return commandRefused(c, { error: 'proposal_closed', state: proposal.state })
    }

    if (lacksReviewerStatus(proposal, body.edits)) {
      return commandRefused(c, { error: 'not_acceptable' })
    }

    const errors: ValidationIssue[] = []
    const expectedDecisionIds = readExpectedDecisionIds(body.expectedDecisionIds, errors)
    const plan = validateAcceptEdits(proposal, body.edits, now)

    if (expectedDecisionIds === null || !plan.ok) {
      return validationFailed(c, [...errors, ...(plan.ok ? [] : plan.errors)])
    }

    const actor = requireActor(c)
    const result = acceptProposal(db, id, { expectedDecisionIds, plan: plan.value, actor, now })

    if (!result.ok) {
      return commandRefused(c, result)
    }

    const ids = new Set(result.decisions.map((decision) => decision.id))

    log(acceptLogLine(result, actor))
    return c.json<ProposalAcceptResponse>({
      proposal: toProposalView(result.proposal),
      decisions: listDecisionViewsByVuln(db, proposal.vulnId, clock()).filter((view) =>
        ids.has(view.decision.id),
      ),
      supersededIds: result.supersededIds,
    })
  })

  routes.post('/:id/reject', async (c) => {
    const id = parseId(c.req.param('id'))
    const body = await readObjectBody(c)

    if (id === null) {
      return notFound(c)
    }

    const errors: ValidationIssue[] = []
    const reason =
      body === null
        ? null
        : readProposalText(
            body.reason,
            'reason',
            { max: PROPOSAL_LIMITS.rejectReason, multiline: true, required: true },
            errors,
          )

    if (reason === null) {
      return validationFailed(c, body === null ? INVALID_BODY : errors)
    }

    const actor = requireActor(c)
    const result = rejectProposal(db, id, reason, actor, clock())

    if (!result.ok) {
      return commandRefused(c, result)
    }

    log(rejectLogLine(result.proposal, actor))
    return c.json<ProposalRejectResponse>({ proposal: toProposalView(result.proposal) })
  })

  return routes
}
