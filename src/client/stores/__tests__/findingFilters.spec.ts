import { describe, expect, it } from 'vitest'

import {
  emptyFilters,
  hasActiveFilters,
  toFindingQuery,
  type FindingFilters,
} from '@/stores/findingFilters'

const NOW = new Date('2026-06-01T12:00:00.000Z')
const KEV_ON: FindingFilters = { ...emptyFilters(), kev: true }

describe('KEV filter', () => {
  it('is off by default and turns the query on when set', () => {
    expect(toFindingQuery(emptyFilters(), 'inbox', NOW).kev).toBe(false)
    expect(toFindingQuery(KEV_ON, 'inbox', NOW).kev).toBe(true)
  })

  it('counts as an active filter until reset', () => {
    expect(hasActiveFilters(emptyFilters())).toBe(false)
    expect(hasActiveFilters(KEV_ON)).toBe(true)
    expect(hasActiveFilters(emptyFilters())).toBe(false)
  })

  it('is ignored without a KEV source', () => {
    expect(toFindingQuery(KEV_ON, 'inbox', NOW, false).kev).toBe(false)
    expect(hasActiveFilters(KEV_ON, false)).toBe(false)
  })
})
