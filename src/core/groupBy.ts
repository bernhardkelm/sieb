/**
 * Groups items by a key, keeping the input order inside each group and the order of first
 * appearance between groups.
 * @param {readonly T[]} items - Items
 * @param {(item: T) => string} key - Group key of an item
 * @returns {Map<string, T[]>} - Groups by key
 */
export const groupBy = <T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>()

  for (const item of items) {
    const group = groups.get(key(item))

    if (group) {
      group.push(item)
    } else {
      groups.set(key(item), [item])
    }
  }

  return groups
}
