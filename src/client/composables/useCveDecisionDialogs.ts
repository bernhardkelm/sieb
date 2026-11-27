import { ref, type Ref } from 'vue'

import type { CveAggregate } from '#core/cveAggregation.ts'
import type { BulkTarget } from '@/components/decision/bulkTargets'

export interface CveDecisionDialogs {
  bulkOpen: Ref<boolean>
  bulkTargets: Ref<BulkTarget[]>
  decideOpen: Ref<boolean>
  decideCve: Ref<CveAggregate | null>
  /** Whether one of the dialogs is open, the list keys pause meanwhile */
  anyOpen: () => boolean
  openBulk: (vulnId: string) => void
  openDecideAll: (vulnId: string) => void
}

/**
 * Holds the two decision dialogs of the by-CVE view: the bulk dialog for every open image of a
 * CVE, and the dialog deciding a CVE for all images including future ones.
 * @param {() => CveAggregate[]} items - Every CVE of the store, unfiltered
 * @returns {CveDecisionDialogs} - Dialog state and openers
 */
export const useCveDecisionDialogs = (items: () => CveAggregate[]): CveDecisionDialogs => {
  const bulkOpen = ref(false)
  const bulkTargets = ref<BulkTarget[]>([])
  const decideOpen = ref(false)
  const decideCve = ref<CveAggregate | null>(null)

  /**
   * Opens the bulk dialog for every open image of a CVE.
   * @param {string} vulnId - Vuln id
   * @returns {void}
   */
  const openBulk = (vulnId: string): void => {
    bulkTargets.value = [{ vulnId, imageRefs: 'all-open' }]
    bulkOpen.value = true
  }

  /**
   * Opens the dialog deciding a CVE for all images, including images that show up later.
   * @param {string} vulnId - Vuln id
   * @returns {void}
   */
  const openDecideAll = (vulnId: string): void => {
    decideCve.value = items().find((cve) => cve.vulnId === vulnId) ?? null
    decideOpen.value = decideCve.value !== null
  }

  return {
    bulkOpen,
    bulkTargets,
    decideOpen,
    decideCve,
    anyOpen: () => bulkOpen.value || decideOpen.value,
    openBulk,
    openDecideAll,
  }
}
