import type { ListKind } from '@/components/list/listKind'

/** Estimated height in px of a single-line row, the --row-height token */
export const ROW_ESTIMATE = 32
/** Estimated height in px of a row that wraps to two lines in a narrow list */
export const NARROW_ROW_ESTIMATE = 62
/** Estimated height in px of a one-line note such as the loading row */
export const NOTE_ESTIMATE = 38
/** List width in px below which rows wrap to two lines, the container query of ListRow */
export const NARROW_LIST_WIDTH = 640

/**
 * Returns the estimated height of a list row until it is measured.
 * @param {boolean} narrow - Whether the list is narrow enough for rows to wrap
 * @returns {number} - Height in px
 */
export const rowEstimate = (narrow: boolean): number =>
  narrow ? NARROW_ROW_ESTIMATE : ROW_ESTIMATE

/**
 * Adds rows that must stay rendered outside the visible range, such as the cursor row and the
 * focused row, to the indexes the virtualizer renders.
 * @param {readonly number[]} indexes - Indexes of the visible range and its overscan
 * @param {readonly (number | undefined)[]} pinned - Indexes to keep, undefined for rows not listed
 * @returns {number[]} - Indexes in ascending order without duplicates
 */
export const withPinned = (
  indexes: readonly number[],
  pinned: readonly (number | undefined)[],
): number[] => {
  const extra = pinned.filter((index): index is number => index !== undefined)

  if (extra.every((index) => indexes.includes(index))) {
    return [...indexes]
  }

  return [...new Set([...indexes, ...extra])].sort((a, b) => a - b)
}

/**
 * Returns the ARIA attributes announcing the position of a rendered row in the full list, so
 * assistive technology reports the size of the whole list although only part of it renders.
 * @param {ListKind} kind - ARIA pattern of the list
 * @param {number} index - Zero-based row index among the virtualized rows
 * @param {number} count - Number of virtualized rows
 * @param {number} headerRows - Header rows above the virtualized ones, counted by aria-rowindex
 * @returns {Record<string, number>} - Attributes to bind on the row element
 */
export const rowAria = (
  kind: ListKind,
  index: number,
  count: number,
  headerRows: number,
): Record<string, number> =>
  kind === 'listbox'
    ? { 'aria-setsize': count, 'aria-posinset': index + 1 }
    : { 'aria-rowindex': index + 1 + headerRows }

/**
 * Builds a lookup from row key to row index.
 * @param {readonly T[]} items - Rows in display order
 * @param {(item: T) => K} keyOf - Key of a row
 * @returns {Map<K, number>} - Index per key
 */
export const indexByKey = <T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, number> =>
  new Map(items.map((item, index) => [keyOf(item), index]))
