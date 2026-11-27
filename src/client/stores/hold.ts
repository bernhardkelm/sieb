export interface Hold {
  /** Takes a hold and returns its release, releasing twice counts once */
  take: () => () => void
  /** Whether at least one hold is taken */
  held: () => boolean
}

/**
 * Counts the holders of a shared resource: the first hold runs onFirst, releasing the last one
 * runs onLast.
 * @param {() => void} onFirst - Runs when the first hold is taken
 * @param {() => void} onLast - Runs when the last hold is released
 * @returns {Hold} - Take and the held state
 */
export const createHold = (onFirst: () => void = () => {}, onLast: () => void = () => {}): Hold => {
  let holders = 0

  return {
    take: () => {
      let released = false

      holders += 1

      if (holders === 1) {
        onFirst()
      }

      return () => {
        if (released) {
          return
        }

        released = true
        holders -= 1

        if (holders === 0) {
          onLast()
        }
      }
    },
    held: () => holders > 0,
  }
}
