import { describe, expect, it } from 'vitest'

import { allOf, bulkLabel, partialTitle } from '@/format/bulkCount'

const PROPOSAL = { singular: 'proposal' }

describe('bulkLabel', () => {
  it('follows the label with the count, the accessible label names the noun', () => {
    expect(bulkLabel('Accept', allOf(1), PROPOSAL)).toEqual({
      text: 'Accept 1',
      ariaLabel: 'Accept 1 proposal',
      partial: undefined,
    })
    expect(bulkLabel('Accept', allOf(1284), PROPOSAL).ariaLabel).toBe('Accept 1,284 proposals')
  })

  it('places the count in a template', () => {
    const label = bulkLabel(
      'Copy for Claude',
      allOf(3),
      { singular: 'finding' },
      'Copy {n} for Claude',
    )

    expect(label.text).toBe('Copy 3 for Claude')
    expect(label.ariaLabel).toBe('Copy 3 findings for Claude')
  })

  it('keeps the plain label without affected items', () => {
    const count = { affected: 0, selected: 2, skipped: ['Only proposals'] }

    expect(bulkLabel('Accept', count, PROPOSAL)).toEqual({
      text: 'Accept',
      ariaLabel: 'Accept',
      partial: undefined,
    })
  })

  it('names how many of the selection it acts on and why the rest is skipped', () => {
    const count = { affected: 4, selected: 5, skipped: ['Only proposals', 'Outdated ones wait.'] }

    expect(bulkLabel('Accept', count, PROPOSAL).partial).toBe(
      '4 of 5 selected. Only proposals. Outdated ones wait.',
    )
    expect(partialTitle({ affected: 5, selected: 5, skipped: ['Only proposals'] })).toBeUndefined()
  })
})
