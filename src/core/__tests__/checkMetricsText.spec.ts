import { describe, expect, it } from 'vitest'

import { renderCheckMetrics, type CheckMetrics } from '#core/checkMetricsText.ts'

const METRICS: CheckMetrics = {
  open: { queued: 3, running: 1 },
  finished: { done: 7, failed: 2, cancelled: 1 },
  durationSecondsSum: 812.5,
  durationCount: 9,
  workerOnline: true,
}

describe('renderCheckMetrics', () => {
  it('renders the open gauge, the finished counter, the duration summary and the worker', () => {
    expect(`${renderCheckMetrics(METRICS).join('\n')}\n`).toBe(
      [
        '# HELP sieb_checks_open Auto-checks waiting or running, by state.',
        '# TYPE sieb_checks_open gauge',
        'sieb_checks_open{state="queued"} 3',
        'sieb_checks_open{state="running"} 1',
        '# HELP sieb_checks_finished_total Auto-checks that ended, by final status.',
        '# TYPE sieb_checks_finished_total counter',
        'sieb_checks_finished_total{status="done"} 7',
        'sieb_checks_finished_total{status="failed"} 2',
        'sieb_checks_finished_total{status="cancelled"} 1',
        '# HELP sieb_check_duration_seconds Run time of the Auto-checks that ended done or failed.',
        '# TYPE sieb_check_duration_seconds summary',
        'sieb_check_duration_seconds_sum 812.5',
        'sieb_check_duration_seconds_count 9',
        '# HELP sieb_check_worker_online Whether the Auto-check worker reached sieb within the last 90 seconds.',
        '# TYPE sieb_check_worker_online gauge',
        'sieb_check_worker_online 1',
        '',
      ].join('\n'),
    )
  })

  it('renders an offline worker as 0 and leaves the gauge out while checks are off', () => {
    const offline = renderCheckMetrics({ ...METRICS, workerOnline: false })
    const off = renderCheckMetrics({ ...METRICS, workerOnline: null })

    expect(offline).toContain('sieb_check_worker_online 0')
    expect(off.some((line) => line.includes('sieb_check_worker_online'))).toBe(false)
    expect(off).toContain('sieb_checks_open{state="queued"} 3')
  })
})
