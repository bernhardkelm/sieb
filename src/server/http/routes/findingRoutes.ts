import { Hono } from 'hono'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { FindingDetailResponse, FindingsSeenResponse } from '#core/findingApiTypes.ts'
import { filterFindings } from '#core/findingFilter.ts'
import { parseFindingQuery } from '#core/findingQuery.ts'
import { isRecentFinding } from '#core/findingRecency.ts'
import { validateSeenFindingIds } from '#core/findingSeen.ts'
import type { FindingView } from '#core/findingView.ts'
import { imageCheckAccessOf } from '#core/imageCheckAccess.ts'
import { imageAccessOf } from '#core/imageVisibility.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { markFindingsSeen, readSeenFindingIds } from '#server/db/findingSeenRepository.ts'
import { getFindingDetail, listFindingViews } from '#server/db/findingViews.ts'
import { inTransaction } from '#server/db/inTransaction.ts'
import { listKevDatesAdded } from '#server/db/kevCatalogRepository.ts'
import { readPendingIndex } from '#server/db/readPendingIndex.ts'
import { readRelatedCoverage } from '#server/db/relatedCoverage.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { requireActor } from '#server/http/identity.ts'
import { parseId } from '#server/http/pathParams.ts'
import { readValidBody } from '#server/http/requestBody.ts'
import { notFound, validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { readImageAccessSources } from '#server/visibility/imageAccessSources.ts'
import type { PullProber } from '#server/visibility/pullProber.ts'

export type FindingRouteDeps = RouteDeps & {
  publicRegistries: readonly string[]
  checksEnabled: boolean // pending=checking reads the open checks only with Auto-check on
  credentialVault?: CredentialVault | null // vault of usable credentials, null while private access is off
  pullProber?: PullProber | null // probes an own image when its detail opens, null in mock mode
}

const DETAIL_PROBE_WAIT_MS = 1500

/**
 * Creates the finding routes: GET / lists findings in inbox order filtered by the query
 * parameters of parseFindingQuery, kevAddedSince only with the cisa KEV source, pending against
 * the Inbox of the acting user and the open checks, each with `seen` for the acting user within
 * the recent window and the open proposal that covers it as a related finding; POST /seen marks
 * recent findings seen for the acting user; GET /:id answers the detail of the side panel, with
 * the CISA catalog entry of a KEV listed finding when the KEV source is cisa, the visibility and
 * ownership of its image and how Auto-check reaches it. An own image without a fresh pull probe
 * is probed first, the answer waits at most 1.5 seconds for it.
 * @param {FindingRouteDeps} deps - Database, clock, KEV source, public registries, Auto-check state, credential vault and pull prober
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/findings
 */
export const createFindingRoutes = ({
  db,
  clock,
  kevSource,
  publicRegistries,
  checksEnabled,
  credentialVault = null,
  pullProber = null,
}: FindingRouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => {
    const query = parseFindingQuery(c.req.query())

    if (!query.ok) {
      return validationFailed(c, query.errors)
    }

    const now = clock()
    const kevDatesAdded = kevSource === 'cisa' ? listKevDatesAdded(db) : null
    const pending = query.value.pending?.length
      ? readPendingIndex(db, c.get('actor'), now, checksEnabled)
      : null

    const actor = c.get('actor')
    const covered = readRelatedCoverage(db)
    const seen = actor === null ? new Set<number>() : readSeenFindingIds(db, actor)
    const listed = filterFindings(listFindingViews(db, now), query.value, {
      kevDatesAdded,
      pending,
    })

    return c.json<FindingView[]>(
      listed.map((finding) => ({
        ...finding,
        seen: seen.has(finding.id) && isRecentFinding(finding.firstSeen, now),
        coveredByProposal: covered.get(finding.id) ?? null,
      })),
    )
  })

  routes.post('/seen', async (c) => {
    if (c.get('actor') === null) {
      return c.json<ErrorBody>({ error: 'unauthorized' }, 401)
    }

    const ids = await readValidBody(c, validateSeenFindingIds)

    if (!ids.ok) {
      return ids.response
    }

    const actor = requireActor(c)
    const ignored = inTransaction(db, () => markFindingsSeen(db, actor, ids.value, clock()))

    return c.json<FindingsSeenResponse>({ ignored })
  })

  routes.get('/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    const found = id === null ? null : getFindingDetail(db, id, clock(), kevSource === 'cisa')

    if (!found) {
      return notFound(c)
    }

    await pullProber?.probeOwn([found.finding], DETAIL_PROBE_WAIT_MS)

    const detail = getFindingDetail(db, found.finding.id, clock(), kevSource === 'cisa') ?? found
    const sources = readImageAccessSources(db, { publicRegistries, credentialVault })
    const image = { imageRef: detail.finding.imageRef, owner: detail.finding.owner }

    return c.json<FindingDetailResponse>({
      ...detail,
      finding: {
        ...detail.finding,
        coveredByProposal: readRelatedCoverage(db).get(detail.finding.id) ?? null,
      },
      ...imageAccessOf(image, sources),
      checkAccess: [imageCheckAccessOf(image, sources)],
    })
  })

  return routes
}
