import { describe, expect, it } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import {
  EMPTY_TEXT,
  flattenTree,
  isCursorItem,
  LOADING_TEXT,
  treeItemEstimate,
} from '@/components/list/flattenTree'
import { NOTE_ESTIMATE, rowEstimate } from '@/components/list/virtualRows'

const GROUPS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const FINDINGS = [buildFindingView({ id: 7 }), buildFindingView({ id: 8 })]

/**
 * Flattens the three test groups.
 * @param {Partial<Parameters<typeof flattenTree>[0]>} overrides - Source fields to set
 * @returns {ReturnType<typeof flattenTree<{ id: string }>>} - Rows
 */
const flatten = (overrides: Partial<Parameters<typeof flattenTree<{ id: string }>>[0]> = {}) =>
  flattenTree({
    groups: GROUPS,
    idOf: (group) => group.id,
    expanded: null,
    findings: [],
    loaded: true,
    ...overrides,
  })

describe('flattenTree', () => {
  it('lists one group row per group while none is expanded', () => {
    expect(flatten().map((item) => item.key)).toEqual(['group:a', 'group:b', 'group:c'])
  })

  it('puts the action panel and the findings right below the expanded group', () => {
    const items = flatten({ expanded: 'b', findings: FINDINGS, panel: true })

    expect(items.map((item) => item.key)).toEqual([
      'group:a',
      'group:b',
      'panel:b',
      'finding:7',
      'finding:8',
      'group:c',
    ])
    expect(items.map((item) => item.kind)).toEqual([
      'group',
      'group',
      'panel',
      'finding',
      'finding',
      'group',
    ])
    expect(items[1]).toMatchObject({ kind: 'group', expanded: true })
    expect(items[0]).toMatchObject({ kind: 'group', expanded: false })
  })

  it('stands in a loading or empty note for the findings of the expanded group', () => {
    expect(flatten({ expanded: 'a', loaded: false })[1]).toMatchObject({
      kind: 'status',
      text: LOADING_TEXT,
    })
    expect(flatten({ expanded: 'a' })[1]).toMatchObject({ kind: 'status', text: EMPTY_TEXT })
  })

  it('matches numeric group ids, as decisions use', () => {
    const items = flattenTree({
      groups: [{ id: 4 }, { id: 5 }],
      idOf: (group) => group.id,
      expanded: 5,
      findings: FINDINGS,
      loaded: true,
    })

    expect(items.map((item) => item.key)).toEqual(['group:4', 'group:5', 'finding:7', 'finding:8'])
  })

  it('yields the cursor keys of the view when the panel and note rows are left out', () => {
    const cursorKeys = flatten({ expanded: 'a', findings: FINDINGS, panel: true })
      .filter(isCursorItem)
      .map((item) => item.key)

    expect(cursorKeys).toEqual(['group:a', 'finding:7', 'finding:8', 'group:b', 'group:c'])
  })
})

describe('treeItemEstimate', () => {
  it('estimates rows by kind and width', () => {
    const estimate = treeItemEstimate(120)
    const [group, panel, finding] = flatten({ expanded: 'a', findings: FINDINGS, panel: true })
    const [, note] = flatten({ expanded: 'a' })

    expect(estimate(panel!, false)).toBe(120)
    expect(estimate(note!, false)).toBe(NOTE_ESTIMATE)
    expect(estimate(group!, false)).toBe(rowEstimate(false))
    expect(estimate(finding!, true)).toBe(rowEstimate(true))
    expect(rowEstimate(true)).toBeGreaterThan(rowEstimate(false))
  })
})
