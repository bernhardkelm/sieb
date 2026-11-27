import type { OverviewStats, StatsPoint } from '#core/overviewStats.ts'

export interface StatsResponse {
  current: OverviewStats // computed live
  series: StatsPoint[] // snapshots of successful syncs, at most one per bucket, oldest first
}
