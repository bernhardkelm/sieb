import { describe, expect, it } from 'vitest'

import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { createCheckFinishTracker } from '@/components/checks/checkFinishes'

const RUNNING = buildCheck({ id: 1, state: 'running', position: null })
const QUEUED = buildCheck({ id: 2, findingId: 2, position: 1 })
const OTHERS = buildCheck({ id: 3, findingId: 3, requestedBy: 'bob', position: 2 })

/**
 * Returns a check as ended.
 * @param {ReturnType<typeof buildCheck>} check - Open check
 * @param {'done' | 'failed' | 'cancelled'} state - End state
 * @returns {ReturnType<typeof buildCheck>} - Ended check
 */
const ended = (check: ReturnType<typeof buildCheck>, state: 'done' | 'failed' | 'cancelled') => ({
  ...check,
  state,
  position: null,
  finishedAt: '2026-06-01T12:05:00.000Z',
})

describe('createCheckFinishTracker', () => {
  it('reports nothing for checks that had ended before the first answer', () => {
    const tracker = createCheckFinishTracker()

    expect(
      tracker.next(buildChecksResponse({ recent: [ended(RUNNING, 'done')] }), 'alice'),
    ).toEqual([])
  })

  it("reports the user's checks that left open for done or failed, once each", () => {
    const tracker = createCheckFinishTracker()

    tracker.next(buildChecksResponse({ running: RUNNING, queued: [QUEUED, OTHERS] }), 'alice')

    const next = buildChecksResponse({
      recent: [ended(OTHERS, 'done'), ended(QUEUED, 'cancelled'), ended(RUNNING, 'failed')],
    })

    expect(tracker.next(next, 'alice').map((check) => [check.id, check.state])).toEqual([
      [1, 'failed'],
    ])
    expect(tracker.next(next, 'alice')).toEqual([])
  })

  it('reports nothing without a known user', () => {
    const tracker = createCheckFinishTracker()

    tracker.next(buildChecksResponse({ running: RUNNING }), null)

    expect(tracker.next(buildChecksResponse({ recent: [ended(RUNNING, 'done')] }), null)).toEqual(
      [],
    )
  })
})
