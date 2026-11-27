import { HOUR_MS } from '#core/timeUnits.ts'
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { recordKevFailure, recordKevSuccess } from '#server/db/kevFeedRepository.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import {
  isKevRefreshDue,
  KEV_CHECK_INTERVAL_MS,
  startKevRefreshSchedule,
} from '#server/kev/kevRefreshSchedule.ts'

const NOW = new Date('2026-11-26T12:00:00.000Z')
const CATALOG = { catalogVersion: '2026.11.24', dateReleased: null, entryCount: 1 }

/**
 * Returns an ISO time some hours before NOW.
 * @param {number} hours - Hours back
 * @returns {string} - ISO time
 */
const hoursAgo = (hours: number): string => new Date(NOW.getTime() - hours * HOUR_MS).toISOString()

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isKevRefreshDue', () => {
  it('is due without a stored catalog and once the last success is a day old', () => {
    const db = openDatabase(MEMORY_DB)

    expect(isKevRefreshDue(db, NOW)).toBe(true)

    recordKevSuccess(db, CATALOG, hoursAgo(23), hoursAgo(23))
    expect(isKevRefreshDue(db, NOW)).toBe(false)

    recordKevSuccess(db, CATALOG, hoursAgo(24), hoursAgo(24))
    expect(isKevRefreshDue(db, NOW)).toBe(true)
  })

  it('waits an hour after a failed attempt before retrying', () => {
    const db = openDatabase(MEMORY_DB)

    recordKevSuccess(db, CATALOG, hoursAgo(30), hoursAgo(30))
    recordKevFailure(db, 'offline', hoursAgo(0.5))
    expect(isKevRefreshDue(db, NOW)).toBe(false)

    recordKevFailure(db, 'offline', hoursAgo(1))
    expect(isKevRefreshDue(db, NOW)).toBe(true)
  })
})

describe('startKevRefreshSchedule', () => {
  it('refreshes on start only for a missing or old catalog, unless forced', () => {
    const fresh = openDatabase(MEMORY_DB)
    const refresh = vi.fn<() => Promise<boolean>>(async () => true)

    recordKevSuccess(fresh, CATALOG, hoursAgo(2), hoursAgo(2))
    startKevRefreshSchedule({ refresh }, { db: fresh, clock: () => NOW }).stop()
    expect(refresh).not.toHaveBeenCalled()

    startKevRefreshSchedule({ refresh }, { db: fresh, clock: () => NOW, force: true }).stop()
    expect(refresh).toHaveBeenCalledTimes(1)

    const missing = openDatabase(MEMORY_DB)

    recordKevFailure(missing, 'offline', hoursAgo(0.1))
    startKevRefreshSchedule({ refresh }, { db: missing, clock: () => NOW }).stop()
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('checks on every interval and refreshes once the catalog turns a day old', () => {
    const db = openDatabase(MEMORY_DB)
    const refresh = vi.fn<() => Promise<boolean>>(async () => true)
    let now = NOW

    recordKevSuccess(db, CATALOG, hoursAgo(23.5), hoursAgo(23.5))
    const schedule = startKevRefreshSchedule({ refresh }, { db, clock: () => now })

    vi.advanceTimersByTime(KEV_CHECK_INTERVAL_MS)
    expect(refresh).not.toHaveBeenCalled()

    now = new Date(NOW.getTime() + HOUR_MS)
    vi.advanceTimersByTime(KEV_CHECK_INTERVAL_MS)
    expect(refresh).toHaveBeenCalledTimes(1)

    schedule.stop()
    vi.advanceTimersByTime(KEV_CHECK_INTERVAL_MS * 4)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
