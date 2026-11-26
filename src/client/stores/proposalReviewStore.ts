import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'

import type { ProposalDetail } from '#core/apiTypes.ts'
import { sameExpectedDecisionIds, type ExpectedDecisionId } from '#core/proposalFreshness.ts'
import { ApiError } from '@/api/ApiError'
import { errorMessage } from '@/api/apiRequest'
import { fetchProposalDetail } from '@/api/proposalsApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'

/**
 * Holds the detail of the proposal in the review panel and the decision ids the reviewer saw,
 * from the first load of that proposal. A reload, as the data version moves, that finds other
 * current decisions flags a conflict, as a proposal_conflict answer does; only acknowledge adopts
 * the new ids and lifts it. Answers of superseded requests are dropped.
 */
export const useProposalReviewStore = defineStore('proposalReview', () => {
  const dataVersion = useDataVersionStore()

  const proposalId = ref<number | null>(null)
  const detail = shallowRef<ProposalDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)
  const conflict = ref(false)
  const reviewedDecisionIds = shallowRef<ExpectedDecisionId[] | null>(null)
  let request = 0

  /**
   * Stores a fetched detail: the first one of a proposal sets the reviewed ids, a later one with
   * other current decisions flags the conflict.
   * @param {ProposalDetail} next - Fetched detail
   * @returns {void}
   */
  const store = (next: ProposalDetail): void => {
    const seen = reviewedDecisionIds.value

    if (seen === null) {
      reviewedDecisionIds.value = next.currentDecisionIds
    } else if (!sameExpectedDecisionIds(seen, next.currentDecisionIds)) {
      conflict.value = true
    }

    detail.value = next
  }

  /**
   * Fetches the detail of a proposal; the previous detail of the same proposal stays visible
   * until the new one arrives, another proposal starts empty, without reviewed ids or a conflict.
   * @param {number} id - Proposal id
   * @returns {Promise<void>} - Resolves when stored or the error recorded
   */
  const load = async (id: number): Promise<void> => {
    const current = ++request

    if (proposalId.value !== id) {
      detail.value = null
      conflict.value = false
      reviewedDecisionIds.value = null
    }

    proposalId.value = id
    loading.value = true

    try {
      const next = await fetchProposalDetail(id)

      if (current === request) {
        store(next)
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
   * Fetches the current proposal again.
   * @returns {Promise<void>} - Resolves when reloaded, at once without a proposal
   */
  const reload = async (): Promise<void> => {
    if (proposalId.value !== null) {
      await load(proposalId.value)
    }
  }

  /**
   * Records whether the last accept found other decisions than the reviewer saw.
   * @param {boolean} value - True after a proposal_conflict answer
   * @returns {void}
   */
  const setConflict = (value: boolean): void => {
    conflict.value = value
  }

  /**
   * Adopts the current decisions of the shown detail as reviewed and lifts the conflict, the
   * reviewer's explicit Review again.
   * @returns {void}
   */
  const acknowledge = (): void => {
    if (detail.value !== null) {
      reviewedDecisionIds.value = detail.value.currentDecisionIds
      conflict.value = false
    }
  }

  /**
   * Forgets the proposal when the panel closes.
   * @returns {void}
   */
  const clear = (): void => {
    request += 1
    proposalId.value = null
    detail.value = null
    error.value = null
    notFound.value = false
    loading.value = false
    conflict.value = false
    reviewedDecisionIds.value = null
  }

  watch(
    () => dataVersion.version,
    () => {
      void reload()
    },
  )

  return {
    proposalId,
    detail,
    loading,
    error,
    notFound,
    conflict,
    reviewedDecisionIds,
    load,
    reload,
    setConflict,
    acknowledge,
    clear,
  }
})
