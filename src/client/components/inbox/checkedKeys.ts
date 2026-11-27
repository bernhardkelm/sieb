/**
 * Returns the checked keys without the removed ones.
 * @param {ReadonlySet<T>} checked - Checked keys
 * @param {Iterable<T>} removed - Keys to uncheck
 * @returns {Set<T>} - Remaining checked keys, in their checked order
 */
export const withoutKeys = <T>(checked: ReadonlySet<T>, removed: Iterable<T>): Set<T> => {
  const drop = new Set(removed)

  return new Set([...checked].filter((key) => !drop.has(key)))
}
