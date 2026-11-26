import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import type { ProposalListItem } from '#core/apiTypes.ts'
import { fetchProposals } from '@/api/proposalsApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'

/**
 * Holds the open proposals for the markers on Triage rows and in the finding panel: one
 * request on first use, refetched whenever the data version moves. The newest request wins, a
 * failed refetch keeps the last answer.
 */
export const useProposalsStore = defineStore('proposals', () => {
  const dataVersion = useDataVersionStore()

  const open = shallowRef<ProposalListItem[]>([])
  let requested = false
  let request = 0

  const byVuln = computed(() => {
    const map = new Map<string, ProposalListItem[]>()

    for (const item of open.value) {
      const list = map.get(item.proposal.vulnId) ?? []

      list.push(item)
      map.set(item.proposal.vulnId, list)
    }

    return map
  })

  /**
   * Fetches the open proposals, keeping the last answer when the request fails.
   * @returns {Promise<void>} - Resolves when stored or failed
   */
  const refresh = async (): Promise<void> => {
    const current = ++request

    requested = true

    try {
      const next = await fetchProposals('open')

      if (current === request) {
        open.value = next
      }
    } catch {
      // markers are a hint, the next data version retries
    }
  }

  /**
   * Fetches the open proposals unless requested before.
   * @returns {Promise<void>} - Resolves when loaded
   */
  const ensureLoaded = async (): Promise<void> => {
    if (!requested) {
      await refresh()
    }
  }

  /**
   * Returns the open proposals covering a finding, newest first: those of its vulnerability
   * that target its image or every image.
   * @param {string} vulnId - Vulnerability id
   * @param {string} imageRef - Image ref of the finding
   * @returns {ProposalListItem[]} - Covering proposals
   */
  const openFor = (vulnId: string, imageRef: string): ProposalListItem[] =>
    (byVuln.value.get(vulnId) ?? []).filter(
      ({ proposal }) => proposal.imageRefs === null || proposal.imageRefs.includes(imageRef),
    )

  watch(
    () => dataVersion.version,
    () => {
      if (requested) {
        void refresh()
      }
    },
  )

  return { open, refresh, ensureLoaded, openFor }
})
