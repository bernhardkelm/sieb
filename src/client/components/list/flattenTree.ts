import type { FindingView } from '#core/findingView.ts'
import { NOTE_ESTIMATE, rowEstimate } from '@/components/list/virtualRows'
import { findingRowKey, groupRowKey } from '@/keyboard/rowKey'

/** One row of a grouped list flattened for virtualization, in display order */
export type TreeItem<G> =
  | { kind: 'group'; key: string; group: G; expanded: boolean }
  | { kind: 'panel'; key: string; group: G }
  | { kind: 'status'; key: string; text: string }
  | { kind: 'finding'; key: string; finding: FindingView }

export interface TreeSource<G> {
  groups: readonly G[]
  idOf: (group: G) => string | number
  /** Identifier of the expanded group, null when none is */
  expanded: string | number | null
  /** Open findings of the expanded group */
  findings: readonly FindingView[]
  /** Whether the findings store has loaded, a loading row stands in before */
  loaded: boolean
  /** Adds an action panel row right below the expanded group row */
  panel?: boolean
}

export const LOADING_TEXT = 'Loading findings…'
export const EMPTY_TEXT = 'No open findings.'

/**
 * Returns the rows below an expanded group: its action panel, a loading or empty note and its
 * findings.
 * @param {G} group - Expanded group
 * @param {string | number} id - Group identifier
 * @param {TreeSource<G>} source - Groups and the findings of the expanded one
 * @returns {TreeItem<G>[]} - Nested rows in display order
 */
const nestedItems = <G>(group: G, id: string | number, source: TreeSource<G>): TreeItem<G>[] => {
  const items: TreeItem<G>[] = []

  if (source.panel) {
    items.push({ kind: 'panel', key: `panel:${id}`, group })
  }

  if (!source.loaded) {
    items.push({ kind: 'status', key: `status:${id}`, text: LOADING_TEXT })
  } else if (source.findings.length === 0) {
    items.push({ kind: 'status', key: `status:${id}`, text: EMPTY_TEXT })
  }

  for (const finding of source.findings) {
    items.push({ kind: 'finding', key: findingRowKey(finding.id), finding })
  }

  return items
}

/**
 * Flattens a list of groups with one expanded group into a single row list, so the nested rows
 * of a large group virtualize like the group rows.
 * @param {TreeSource<G>} source - Groups and the findings of the expanded one
 * @returns {TreeItem<G>[]} - Rows in display order
 */
export const flattenTree = <G>(source: TreeSource<G>): TreeItem<G>[] =>
  source.groups.flatMap((group) => {
    const id = source.idOf(group)
    const expanded = id === source.expanded
    const row: TreeItem<G> = { kind: 'group', key: groupRowKey(id), group, expanded }

    return expanded ? [row, ...nestedItems(group, id, source)] : [row]
  })

/**
 * Returns whether a row takes the keyboard cursor, which group and finding rows do.
 * @param {TreeItem<unknown>} item - Row
 * @returns {boolean} - True for group and finding rows
 */
export const isCursorItem = (item: TreeItem<unknown>): boolean =>
  item.kind === 'group' || item.kind === 'finding'

/**
 * Returns the row key of a flattened row, the key the cursor and the virtualizer share.
 * @param {TreeItem<unknown>} item - Row
 * @returns {string} - Row key
 */
export const treeItemKey = (item: TreeItem<unknown>): string => item.key

/**
 * Returns the size estimate of the rows of a flattened list, with the height of its action panel.
 * @param {number} panelHeight - Estimated height in px of the action panel row
 * @returns {(item: TreeItem<unknown>, narrow: boolean) => number} - Estimate per row in px
 */
export const treeItemEstimate =
  (panelHeight: number) =>
  (item: TreeItem<unknown>, narrow: boolean): number => {
    if (item.kind === 'panel') {
      return panelHeight
    }

    return item.kind === 'status' ? NOTE_ESTIMATE : rowEstimate(narrow)
  }
