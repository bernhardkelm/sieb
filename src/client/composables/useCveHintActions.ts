import type { CveAggregate } from '#core/cveAggregation.ts'
import { useHintActions } from '@/composables/useHintActions'

export interface CveHintSources {
  /** CVE of the cursor row, the CVE row itself or a finding row below it */
  currentCve: () => CveAggregate | null
  openBulk: (vulnId: string) => void
  openDecideAll: (vulnId: string) => void
  focusSearch: () => void
  refocus: () => Promise<void>
}

const NO_CURSOR = 'No CVE under the cursor'

/**
 * Registers the by-CVE hint actions: Decide open images and Decide all images open the dialogs
 * Shift+A and Shift+D open for the cursor CVE, Search focuses the search input as / does.
 * Decide open images is blocked once every open image is decided, as its button in the row is.
 * @param {CveHintSources} sources - Cursor CVE and the dialogs of the view
 * @returns {void}
 */
export const useCveHintActions = (sources: CveHintSources): void => {
  const { currentCve, openBulk, openDecideAll } = sources

  useHintActions(
    {
      decideOpen: {
        run: () => {
          const cve = currentCve()

          if (cve !== null) {
            openBulk(cve.vulnId)
          }
        },
        blockedBy: () => {
          const cve = currentCve()

          if (cve === null) {
            return NO_CURSOR
          }

          return cve.inboxCount === 0 ? 'Every open image is decided' : null
        },
      },
      decideAll: {
        run: () => {
          const cve = currentCve()

          if (cve !== null) {
            openDecideAll(cve.vulnId)
          }
        },
        blockedBy: () => (currentCve() === null ? NO_CURSOR : null),
      },
      search: { run: sources.focusSearch },
    },
    sources.refocus,
  )
}
