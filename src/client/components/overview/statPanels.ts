import type { StatsResponse } from '#core/statsApiTypes.ts'
import { STATS_RANGE_PERIODS, type StatsRange } from '#core/statsRange.ts'
import type { SparkPoint } from '@/components/overview/sparkline'
import {
  deltaTone,
  describeTrend,
  formatDelta,
  type DeltaTone,
} from '@/components/overview/statDelta'
import {
  STAT_PANEL_SPECS,
  type StatPanelKey,
  type StatPanelSpec,
  type StatTarget,
} from '@/components/overview/statPanelSpecs'
import { formatCount } from '@/format/count'

export interface StatPanelModel {
  key: StatPanelKey
  label: string
  valueText: string
  deltaText: string | null // null without history
  tone: DeltaTone
  points: SparkPoint[] // history plus the live value, empty without history
  trendLabel: string | null // trend in words
  trendTitle: string | null // first and last value, shown on hover
  target: StatTarget | null
  primary: boolean
}

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

/**
 * Builds the view model of one panel. The live value ends the trend at the time of the fetch,
 * so a decision moves the line before the next sync records a snapshot. Snapshots without the
 * count of the panel are left out of its trend.
 * @param {StatPanelSpec} spec - Panel definition
 * @param {StatsResponse} response - Live stats and history
 * @param {number} fetchedAt - Epoch ms of the answer
 * @param {string} period - Period of the history in words
 * @returns {StatPanelModel} - Panel view model
 */
const buildPanel = (
  spec: StatPanelSpec,
  response: StatsResponse,
  fetchedAt: number,
  period: string,
): StatPanelModel => {
  const current = spec.value(response.current) ?? 0
  const base = {
    key: spec.key,
    label: spec.label,
    valueText: formatCount(current),
    target: spec.target,
    primary: spec.primary,
  }
  const history = response.series.flatMap((point) => {
    const value = spec.value(point.stats)

    return value === null ? [] : [{ time: Date.parse(point.at), value }]
  })
  const first = history[0]

  if (first === undefined) {
    return {
      ...base,
      deltaText: null,
      tone: 'neutral',
      points: [],
      trendLabel: null,
      trendTitle: null,
    }
  }

  const lastTime = history[history.length - 1]!.time
  const delta = current - first.value

  return {
    ...base,
    deltaText: formatDelta(delta),
    tone: deltaTone(delta, spec.polarity),
    points: [...history, { time: Math.max(fetchedAt, lastTime), value: current }],
    trendLabel: `Trend ${describeTrend(first.value, current, period)}`,
    trendTitle: `${DAY_FORMAT.format(first.time)}: ${formatCount(first.value)}\nNow: ${formatCount(current)}`,
  }
}

/**
 * Builds the overview panels from a stats answer, leaving out the exposure panels while no open
 * finding has an exposure label and the KEV panel without a KEV source.
 * @param {StatsResponse} response - Live stats and history, oldest first
 * @param {number} fetchedAt - Epoch ms of the answer
 * @param {StatsRange} range - Range the history covers
 * @param {{ exposure: boolean; kev?: boolean }} labels - Whether open findings carry an exposure label, whether a KEV source is configured
 * @returns {StatPanelModel[]} - Panels in display order
 */
export const buildStatPanels = (
  response: StatsResponse,
  fetchedAt: number,
  range: StatsRange,
  labels: { exposure: boolean; kev?: boolean } = { exposure: true },
): StatPanelModel[] => {
  const period = STATS_RANGE_PERIODS[range]

  return STAT_PANEL_SPECS.filter(
    (spec) => (labels.exposure || !spec.needsExposure) && (labels.kev !== false || !spec.needsKev),
  ).map((spec) => buildPanel(spec, response, fetchedAt, period))
}
