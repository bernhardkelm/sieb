import type { SourceSnapshot } from '#core/sourceSnapshot.ts'
import type { FindingSource } from '#server/sources/FindingSource.ts'

/**
 * Builds a source returning queued results in order.
 * @param {(SourceSnapshot | Error)[]} results - Snapshots or errors
 * @returns {FindingSource} - Source
 */
export const queuedSource = (results: (SourceSnapshot | Error)[]): FindingSource => ({
  kind: 'mock',
  fetchSnapshot: async () => {
    const next = results.shift()

    if (!next || next instanceof Error) {
      throw next ?? new Error('no snapshot queued')
    }

    return next
  },
})

/**
 * Discards log lines.
 * @returns {void}
 */
export const quiet = (): void => {}
