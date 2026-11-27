import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import type { FindingDetailResponse } from '#core/findingApiTypes.ts'
import type { DecisionStatus } from '#core/decision.ts'
import { ApiError } from '@/api/ApiError'
import { errorMessage } from '@/api/apiRequest'
import { fetchFindingDetail } from '@/api/findingsApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'

/** Request to open the decision form with a status, token changes on every request */
export interface DecisionRequest {
  findingId: number
  status: DecisionStatus
  token: number
}

/**
 * Holds the detail of the finding shown in the side panel, requests to open its decision form,
 * which list views send from their shortcuts, and whether that form holds an unsaved draft,
 * which pauses the keys that would move the panel away. Reloads when the data version moves.
 */
export const useFindingDetailStore = defineStore('findingDetail', () => {
  const dataVersion = useDataVersionStore()

  const findingId = ref<number | null>(null)
  const detail = ref<FindingDetailResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)
  const decisionRequest = ref<DecisionRequest | null>(null)
  const draftDirty = ref(false)
  let request = 0

  /**
   * Fetches the detail of a finding; the previous detail stays visible until the new one
   * arrives, and answers of superseded requests are dropped.
   * @param {number} id - Finding id
   * @returns {Promise<void>} - Resolves when stored or the error recorded
   */
  const load = async (id: number): Promise<void> => {
    const current = ++request

    findingId.value = id
    loading.value = true

    try {
      const next = await fetchFindingDetail(id)

      if (current === request) {
        detail.value = next
        error.value = null
        notFound.value = false
      }
    } catch (failure) {
      if (current === request) {
        detail.value = null
        notFound.value = failure instanceof ApiError && failure.status === 404
        error.value = errorMessage(failure)
      }
    } finally {
      if (current === request) {
        loading.value = false
      }
    }
  }

  /**
   * Fetches the current finding again.
   * @returns {Promise<void>} - Resolves when reloaded, at once without a finding
   */
  const reload = async (): Promise<void> => {
    if (findingId.value !== null) {
      await load(findingId.value)
    }
  }

  /**
   * Forgets the current finding when the panel closes.
   * @returns {void}
   */
  const clear = (): void => {
    request += 1
    findingId.value = null
    detail.value = null
    error.value = null
    notFound.value = false
    loading.value = false
    draftDirty.value = false
  }

  /**
   * Asks the panel to open the decision form of a finding with a status preselected.
   * @param {number} id - Finding id
   * @param {DecisionStatus} status - Preselected status
   * @returns {void}
   */
  const requestDecision = (id: number, status: DecisionStatus): void => {
    decisionRequest.value = {
      findingId: id,
      status,
      token: (decisionRequest.value?.token ?? 0) + 1,
    }
  }

  /**
   * Records whether the decision form of the panel holds unsaved input.
   * @param {boolean} dirty - Whether the form differs from its starting values
   * @returns {void}
   */
  const setDraftDirty = (dirty: boolean): void => {
    draftDirty.value = dirty
  }

  watch(
    () => dataVersion.version,
    () => {
      void reload()
    },
  )

  return {
    findingId,
    detail,
    loading,
    error,
    notFound,
    decisionRequest,
    draftDirty,
    load,
    reload,
    clear,
    requestDecision,
    setDraftDirty,
  }
})
