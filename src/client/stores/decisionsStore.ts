import { defineStore } from 'pinia'

import { fetchDecisions } from '@/api/decisionsApi'
import { useRemoteList } from '@/composables/useRemoteList'

/**
 * Holds every decision with its state, newest first; the decisions view groups them into tabs on
 * the client. Refetches whenever the data version moves.
 */
export const useDecisionsStore = defineStore('decisions', () =>
  useRemoteList(() => fetchDecisions()),
)
