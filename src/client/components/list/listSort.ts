export const SORT_DIRECTIONS = ['asc', 'desc'] as const

export type SortDirection = (typeof SORT_DIRECTIONS)[number]

/** Value a column sorts by; tuples compare element by element */
export type SortValue = number | string | readonly number[]

export interface SortColumn<T> {
  label: string
  /** Direction of the first click: descending for ranks, counts and dates, ascending for text */
  first: SortDirection
  /** Value of an item, null sorts last in both directions */
  value: (item: T) => SortValue | null
}

export type SortColumns<T, C extends string> = Readonly<Record<C, SortColumn<T>>>

export interface SortState<C extends string> {
  column: C
  direction: SortDirection
}

const COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/**
 * Compares two non-null sort values in ascending order: numbers by size, strings naturally so
 * CVE-2024-999 precedes CVE-2024-1000, tuples element by element.
 * @param {SortValue} a - First value
 * @param {SortValue} b - Second value
 * @returns {number} - Negative when a sorts before b
 */
export const compareSortValues = (a: SortValue, b: SortValue): number => {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  if (typeof a === 'string' && typeof b === 'string') {
    return COLLATOR.compare(a, b)
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
      const difference = (a[index] ?? 0) - (b[index] ?? 0)

      if (difference !== 0) {
        return difference
      }
    }

    return 0
  }

  return 0
}

/**
 * Sorts items by a column, stable: nulls last in both directions, ties keep the fallback order,
 * or the given order without a fallback. Without a sort the items keep their order.
 * @param {readonly T[]} items - Items in default order
 * @param {SortColumns<T, C>} columns - Sortable columns of the view
 * @param {SortState<C> | null} sort - Active sort, null for the default order
 * @param {(a: T, b: T) => number} fallback - Default order for ties
 * @returns {T[]} - Sorted copy
 */
export const sortItems = <T, C extends string>(
  items: readonly T[],
  columns: SortColumns<T, C>,
  sort: SortState<C> | null,
  fallback?: (a: T, b: T) => number,
): T[] => {
  if (sort === null) {
    return [...items]
  }

  const { value } = columns[sort.column]
  const sign = sort.direction === 'asc' ? 1 : -1
  const decorated = items.map((item, index) => ({ item, index, value: value(item) }))

  decorated.sort((a, b) => {
    const nulls = Number(a.value === null) - Number(b.value === null)

    if (nulls !== 0) {
      return nulls
    }

    const order =
      a.value === null || b.value === null ? 0 : sign * compareSortValues(a.value, b.value)

    return order || (fallback?.(a.item, b.item) ?? 0) || a.index - b.index
  })

  return decorated.map(({ item }) => item)
}
