import { describe, expect, it } from 'vitest'

import { allOf, FINDING_NOUN } from '@/format/bulkCount'
import { hintView } from '@/keyboard/hintView'
import type { KeyboardHint } from '@/keyboard/keyboardHints'

const ACCEPT: KeyboardHint = { keys: ['a'], label: 'Accept', action: 'accept' }
const COPY: KeyboardHint = {
  keys: ['h'],
  label: 'Copy for Claude',
  template: 'Copy {n} for Claude',
  action: 'handoff',
}

describe('hintView', () => {
  it('keeps the plain label and the block reason while the action acts on the cursor row', () => {
    expect(hintView(ACCEPT, null, null)).toEqual({
      hint: ACCEPT,
      text: 'Accept',
      ariaLabel: undefined,
      title: undefined,
      blockedBy: null,
    })
    expect(hintView(ACCEPT, 'No finding under the cursor', null).title).toBe(
      'No finding under the cursor',
    )
  })

  it('counts the checked items after the label or at the template', () => {
    expect(hintView(ACCEPT, null, { count: allOf(5), noun: FINDING_NOUN })).toMatchObject({
      text: 'Accept 5',
      ariaLabel: 'Accept 5 findings',
      title: undefined,
    })
    expect(hintView(COPY, null, { count: allOf(1), noun: FINDING_NOUN })).toMatchObject({
      text: 'Copy 1 for Claude',
      ariaLabel: 'Copy 1 finding for Claude',
    })
  })

  it('names a partial count in the tooltip unless a block reason takes its place', () => {
    const bulk = {
      count: { affected: 4, selected: 5, skipped: ['Findings with an open check are skipped.'] },
      noun: FINDING_NOUN,
    }

    expect(hintView(ACCEPT, null, bulk).title).toBe(
      '4 of 5 selected. Findings with an open check are skipped.',
    )
    expect(hintView(ACCEPT, 'The queue is full (500 open checks).', bulk)).toMatchObject({
      text: 'Accept 4',
      title: 'The queue is full (500 open checks).',
    })
  })

  it('keeps the plain label while none of the checked items is affected', () => {
    const bulk = { count: { affected: 0, selected: 3, skipped: [] }, noun: FINDING_NOUN }

    expect(hintView(ACCEPT, 'Nothing to accept', bulk)).toMatchObject({
      text: 'Accept',
      ariaLabel: undefined,
      title: 'Nothing to accept',
    })
  })
})
