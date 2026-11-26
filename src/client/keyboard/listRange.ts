/**
 * Returns the ids between two rows, both included, in display order.
 * @param {readonly T[]} ids - Row ids in display order
 * @param {T} from - One end of the range
 * @param {T} to - Other end of the range
 * @returns {T[]} - Ids of the range, only `to` when `from` is not listed, empty without `to`
 */
export const rangeBetween = <T>(ids: readonly T[], from: T, to: T): T[] => {
  const start = ids.indexOf(from)
  const end = ids.indexOf(to)

  if (end === -1) {
    return []
  }

  if (start === -1) {
    return [to]
  }

  return ids.slice(Math.min(start, end), Math.max(start, end) + 1)
}

/**
 * Returns the checked rows of a range selection: the rows checked before the range started,
 * as far as they are still listed, plus every row from the anchor to the head. Moving the head
 * back towards the anchor therefore shrinks the range again.
 * @param {readonly T[]} ids - Row ids in display order
 * @param {ReadonlySet<T>} base - Rows checked when the anchor was set
 * @param {T} anchor - Row the range started from
 * @param {T} head - Row the range extends to
 * @returns {Set<T>} - Checked rows
 */
export const withRange = <T>(ids: readonly T[], base: ReadonlySet<T>, anchor: T, head: T): Set<T> =>
  new Set([...ids.filter((id) => base.has(id)), ...rangeBetween(ids, anchor, head)])
