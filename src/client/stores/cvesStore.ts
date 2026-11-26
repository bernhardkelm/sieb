import { defineStore } from 'pinia'

import { fetchCves } from '@/api/cvesApi'
import { useRemoteList } from '@/composables/useRemoteList'

/**
 * Holds the open findings aggregated per CVE across images, in inbox order. Refetches whenever
 * the data version moves.
 */
export const useCvesStore = defineStore('cves', () => useRemoteList(() => fetchCves()))
