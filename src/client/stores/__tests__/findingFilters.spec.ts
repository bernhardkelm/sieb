import { describe, expect, it } from 'vitest'

import {
  emptyFilters,
  hasActiveFilters,
  toFindingQuery,
  withoutHiddenColumns,
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
    expect(toFindingQuery(KEV_ON, 'inbox', NOW, ['kev']).kev).toBe(false)
    expect(hasActiveFilters(KEV_ON, ['kev'])).toBe(false)
  })
})

describe('filters on hidden label columns', () => {
  const labelled: FindingFilters = {
    ...emptyFilters(),
    exposure: ['public', 'unknown'],
    owner: ['self'],
  }

  it('narrows the query while the columns show', () => {
    const query = toFindingQuery(labelled, 'inbox', NOW)

    expect([query.exposure, query.owner]).toEqual([['public', 'unknown'], ['self']])
    expect(hasActiveFilters(labelled)).toBe(true)
  })

  it('stays set but is ignored and not active while the columns are hidden', () => {
    const query = toFindingQuery(labelled, 'inbox', NOW, ['exposure', 'owner'])

    expect([query.exposure, query.owner]).toEqual([[], []])
    expect(hasActiveFilters(labelled, ['exposure', 'owner'])).toBe(false)
    expect(withoutHiddenColumns(labelled, ['owner'])).toEqual({ ...labelled, owner: [] })
  })
})
