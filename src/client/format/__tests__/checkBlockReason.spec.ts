import { describe, expect, it } from 'vitest'

import { MAX_OPEN_CHECKS } from '#core/checkLimits.ts'
import { queueRoomReason } from '@/format/checkBlockReason'

describe('queueRoomReason', () => {
  it('lets every selection pass that fits into the room left', () => {
    expect(queueRoomReason(0, MAX_OPEN_CHECKS)).toBeNull()
    expect(queueRoomReason(498, 2)).toBeNull()
    expect(queueRoomReason(MAX_OPEN_CHECKS, 0)).toBeNull()
  })

  it('names the open checks and the room left for a selection larger than the room', () => {
    expect(queueRoomReason(498, 3)).toBe(
      'The queue holds at most 500 checks: 498 are open, so at most 2 more fit. Select fewer findings.',
    )
    expect(queueRoomReason(1, 500)).toBe(
      'The queue holds at most 500 checks: 1 is open, so at most 499 more fit. Select fewer findings.',
    )
  })

  it('reports a full queue, also one beyond the cap', () => {
    expect(queueRoomReason(500, 1)).toBe('The queue is full (500 open checks).')
    expect(queueRoomReason(503, 1)).toBe('The queue is full (500 open checks).')
  })
})
