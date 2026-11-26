export interface Random {
  next: () => number // uniform in [0, 1)
  int: (min: number, max: number) => number // inclusive bounds
  chance: (probability: number) => boolean
  pick: <T>(items: readonly T[]) => T
  hex: (length: number) => string
}

/**
 * Creates a seeded mulberry32 generator, so fixture generation is deterministic.
 * @param {number} seed - 32-bit seed
 * @returns {Random} - Generator
 */
export const createRandom = (seed: number): Random => {
  let state = seed >>> 0

  /**
   * Returns the next uniform value.
   * @returns {number} - Value in [0, 1)
   */
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /**
   * Returns an integer between two bounds.
   * @param {number} min - Lower bound
   * @param {number} max - Upper bound, inclusive
   * @returns {number} - Integer
   */
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1))

  return {
    next,
    int,
    chance: (probability) => next() < probability,
    pick: (items) => {
      const item = items[int(0, items.length - 1)]

      if (item === undefined) {
        throw new Error('pick from an empty list')
      }

      return item
    },
    hex: (length) => Array.from({ length }, () => int(0, 15).toString(16)).join(''),
  }
}
