import { Hono } from 'hono'

import type { StatsResponse } from '#core/statsApiTypes.ts'
import { downsampleLatest } from '#core/seriesDownsampling.ts'
import {
  DEFAULT_STATS_RANGE,
  isStatsRange,
  STATS_MAX_POINTS,
  statsRangeStart,
} from '#core/statsRange.ts'
import { readOverviewStats } from '#server/db/readOverviewStats.ts'
import { listStatsSnapshots } from '#server/db/statsSnapshotRepository.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

/**
 * Creates the stats routes: GET / answers the live overview stats and the snapshots of the
 * ?range=24h|7d|30d|90d (default 30d) before now, at most STATS_MAX_POINTS of them, oldest first.
 * @param {RouteDeps} deps - Database and clock
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/stats
 */
export const createStatsRoutes = ({ db, clock }: RouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => {
    const range = c.req.query('range') ?? DEFAULT_STATS_RANGE
    const now = clock()

    if (!isStatsRange(range)) {
      return validationFailed(c, [{ field: 'range', code: 'invalid' }])
    }

    const from = statsRangeStart(range, now)

    return c.json<StatsResponse>({
      current: readOverviewStats(db, now),
      series: downsampleLatest(listStatsSnapshots(db, from), { from, to: now }, STATS_MAX_POINTS),
    })
  })

  return routes
}
