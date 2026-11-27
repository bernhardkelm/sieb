import {
  SORT_DIRECTIONS,
  type SortColumns,
  type SortDirection,
  type SortState,
} from '@/components/list/listSort'

/**
 * Returns the sort after a click on a column header: a new column starts in its first
 * direction, the next click flips it, the third returns to the default order.
 * @param {SortState<C> | null} sort - Active sort
 * @param {C} column - Clicked column
 * @param {SortDirection} first - First direction of the column
 * @returns {SortState<C> | null} - Next sort, null for the default order
 */
export const nextSort = <C extends string>(
  sort: SortState<C> | null,
  column: C,
  first: SortDirection,
): SortState<C> | null => {
  if (sort?.column !== column) {
    return { column, direction: first }
  }

  return sort.direction === first ? { column, direction: first === 'asc' ? 'desc' : 'asc' } : null
}

/**
 * Returns whether a value names a sortable column.
 * @param {SortColumns<T, C>} columns - Sortable columns
 * @param {string | null} value - Candidate
 * @returns {boolean} - True for a known column id
 */
const isSortColumn = <T, C extends string>(
  columns: SortColumns<T, C>,
  value: string | null,
): value is C => value !== null && Object.hasOwn(columns, value)

/**
 * Reads a sort from its query params. A known column without a direction uses its first
 * direction; an unknown column or direction falls back to the default order.
 * @param {SortColumns<T, C>} columns - Sortable columns of the view
 * @param {string | null} column - Value of the sort param
 * @param {string | null} direction - Value of the dir param
 * @returns {SortState<C> | null} - Sort, null for the default order
 */
export const parseSort = <T, C extends string>(
  columns: SortColumns<T, C>,
  column: string | null,
  direction: string | null,
): SortState<C> | null => {
  if (!isSortColumn(columns, column)) {
    return null
  }

  if (direction === null) {
    return { column, direction: columns[column].first }
  }

  return (SORT_DIRECTIONS as readonly string[]).includes(direction)
    ? { column, direction: direction as SortDirection }
    : null
}

/**
 * Returns the aria-sort value of a column header.
 * @param {SortState<C> | null} sort - Active sort
 * @param {C} column - Column of the header
 * @returns {'ascending' | 'descending' | undefined} - Value, undefined for unsorted columns
 */
export const ariaSort = <C extends string>(
  sort: SortState<C> | null,
  column: C,
): 'ascending' | 'descending' | undefined => {
  if (sort?.column !== column) {
    return undefined
  }

  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

/**
 * Describes the active sort for the list summary.
 * @param {SortColumns<T, C>} columns - Sortable columns of the view
 * @param {SortState<C> | null} sort - Active sort
 * @returns {string | null} - Such as "Severity, descending", null for the default order
 */
export const describeSort = <T, C extends string>(
  columns: SortColumns<T, C>,
  sort: SortState<C> | null,
): string | null =>
  sort === null
    ? null
    : `${columns[sort.column].label}, ${sort.direction === 'asc' ? 'ascending' : 'descending'}`
