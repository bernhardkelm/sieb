import { Hono } from 'hono'

import type { ProposalDetail, ProposalListItem } from '#core/proposalApiTypes.ts'
import { nonBlank } from '#core/decisionFieldReaders.ts'
import { PROPOSAL_STATES, type ProposalState } from '#core/proposal.ts'
import { getProposalDetail, listProposalItems } from '#server/db/proposalViews.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { parseId } from '#server/http/pathParams.ts'
import { notFound, validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

export interface ProposalRouteDeps extends RouteDeps {
  publicRegistries: readonly string[]
}

/**
 * Creates the proposal read routes: GET / lists proposals, ?state= open (default), accepted,
 * rejected, superseded or all and ?vulnId=; GET /:id answers the review detail with sieb's facts
 * per image and the current decisions.
 * @param {ProposalRouteDeps} deps - Database, clock, KEV source, public registries
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/proposals
 */
export const createProposalRoutes = (deps: ProposalRouteDeps): Hono<AppEnv> => {
  const { db, clock, kevSource, publicRegistries } = deps
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => {
    const state = c.req.query('state') ?? 'open'
    const vulnId = nonBlank(c.req.query('vulnId'))

    if (state !== 'all' && !(PROPOSAL_STATES as readonly string[]).includes(state)) {
      return validationFailed(c, [{ field: 'state', code: 'invalid' }])
    }

    return c.json<ProposalListItem[]>(
      listProposalItems(db, {
        ...(state === 'all' ? {} : { state: state as ProposalState }),
        ...(vulnId === null ? {} : { vulnId }),
      }),
    )
  })

  routes.get('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    const detail =
      id === null
        ? null
        : getProposalDetail(db, id, {
            now: clock(),
            publicRegistries,
            kevDetails: kevSource === 'cisa',
          })

    return detail ? c.json<ProposalDetail>(detail) : notFound(c)
  })

  return routes
}
