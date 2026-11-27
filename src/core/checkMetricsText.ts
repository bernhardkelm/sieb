import { metricHeader, sample } from '#core/metricsFormat.ts'

export const OPEN_CHECK_STATES = ['queued', 'running'] as const

export const ENDED_CHECK_STATES = ['done', 'failed', 'cancelled'] as const

export type OpenCheckState = (typeof OPEN_CHECK_STATES)[number]

export type EndedCheckState = (typeof ENDED_CHECK_STATES)[number]

/** Auto-check values of /metrics, all derived from the checks table but the worker presence */
export interface CheckMetrics {
  open: Record<OpenCheckState, number>
  finished: Record<EndedCheckState, number> // every check that ever ended, rows are never deleted
  durationSecondsSum: number // done and failed checks with a duration
  durationCount: number
  workerOnline: boolean | null // null while SIEB_CHECKS_ENABLED is off
}

/**
 * Renders the Auto-check series: the open checks per state, the ended checks per status as a
 * counter, the run time of done and failed checks as a summary without quantiles and, only
 * while checks are enabled, whether the worker is online.
 * @param {CheckMetrics} metrics - Check values
 * @returns {string[]} - HELP, TYPE and sample lines
 */
export const renderCheckMetrics = (metrics: CheckMetrics): string[] => [
  ...metricHeader('sieb_checks_open', 'gauge', 'Auto-checks waiting or running, by state.'),
  ...OPEN_CHECK_STATES.map((state) => sample('sieb_checks_open', { state }, metrics.open[state])),
  ...metricHeader(
    'sieb_checks_finished_total',
    'counter',
    'Auto-checks that ended, by final status.',
  ),
  ...ENDED_CHECK_STATES.map((status) =>
    sample('sieb_checks_finished_total', { status }, metrics.finished[status]),
  ),
  ...metricHeader(
    'sieb_check_duration_seconds',
    'summary',
    'Run time of the Auto-checks that ended done or failed.',
  ),
  sample('sieb_check_duration_seconds_sum', {}, metrics.durationSecondsSum),
  sample('sieb_check_duration_seconds_count', {}, metrics.durationCount),
  ...(metrics.workerOnline === null
    ? []
    : [
        ...metricHeader(
          'sieb_check_worker_online',
          'gauge',
          'Whether the Auto-check worker reached sieb within the last 90 seconds.',
        ),
        sample('sieb_check_worker_online', {}, metrics.workerOnline ? 1 : 0),
      ]),
]
