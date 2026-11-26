/**
 * Moves a cursor through a list by a step, clamped to its ends. Without a cursor a step down
 * starts at the first item and a step up at the last.
 * @param {readonly T[]} ids - Item ids in display order
 * @param {T | null} currentId - Current item
 * @param {number} delta - Step, negative moves up
 * @returns {T | null} - New current item, null for an empty list
 */
export const moveCursor = <T>(ids: readonly T[], currentId: T | null, delta: number): T | null => {
  if (ids.length === 0) {
    return null
  }

  const index = currentId === null ? -1 : ids.indexOf(currentId)

  if (index === -1) {
    return delta < 0 ? ids[ids.length - 1]! : ids[0]!
  }

  return ids[Math.min(ids.length - 1, Math.max(0, index + delta))]!
}

/**
 * Keeps the cursor sensible after the list changed. An item that left the list hands the cursor
 * to the next item that is still listed, or the previous one at the end of the list.
 * @param {readonly T[]} previousIds - Ids before the change
 * @param {readonly T[]} nextIds - Ids after the change
 * @param {T | null} currentId - Cursor before the change
 * @returns {T | null} - Cursor after the change, null when nothing is left
 */
export const reconcileCursor = <T>(
  previousIds: readonly T[],
  nextIds: readonly T[],
  currentId: T | null,
): T | null => {
  if (currentId === null || nextIds.includes(currentId)) {
    return currentId
  }

  const remaining = new Set(nextIds)
  const index = previousIds.indexOf(currentId)

  if (index === -1) {
    return nextIds[0] ?? null
  }

  const after = previousIds.slice(index + 1).find((id) => remaining.has(id))
  const before = previousIds
    .slice(0, index)
    .reverse()
    .find((id) => remaining.has(id))

  return after ?? before ?? nextIds[0] ?? null
}

/**
 * Toggles an id in a set of checked ids.
 * @param {ReadonlySet<T>} checked - Checked ids
 * @param {T} id - Id to toggle
 * @returns {Set<T>} - New set
 */
export const toggleId = <T>(checked: ReadonlySet<T>, id: T): Set<T> => {
  const next = new Set(checked)

  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }

  return next
}
