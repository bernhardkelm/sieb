import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import type { StatsResponse } from '#core/statsApiTypes.ts'
import { DEFAULT_STATS_RANGE, isStatsRange, type StatsRange } from '#core/statsRange.ts'
import { errorMessage } from '@/api/apiRequest'
import { fetchStats } from '@/api/statsApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'

export const STATS_RANGE_STORAGE_KEY = 'sieb-stats-range'

/**
 * Reads the remembered history range, the default when storage is empty, invalid or blocked.
 * @returns {StatsRange} - Stored range
 */
export const readStoredRange = (): StatsRange => {
  try {
    const stored = localStorage.getItem(STATS_RANGE_STORAGE_KEY)

    return isStatsRange(stored) ? stored : DEFAULT_STATS_RANGE
  } catch {
    return DEFAULT_STATS_RANGE
  }
}

/**
 * Remembers the history range.
 * @param {StatsRange} range - Selected range
 * @returns {void}
 */
const storeRange = (range: StatsRange): void => {
  try {
    localStorage.setItem(STATS_RANGE_STORAGE_KEY, range)
  } catch {
    // storage blocked, the range still applies for this page view
  }
}

/**
 * Holds the overview stats of the selected history range. The newest request wins over older
 * ones still in flight, a failed refetch keeps the last answer, and loaded stats refetch when
 * the data version moves, after a sync or a decision.
 */
export const useStatsStore = defineStore('stats', () => {
  const dataVersion = useDataVersionStore()

  const range = ref<StatsRange>(readStoredRange())
  const data = ref<StatsResponse | null>(null)
  const fetchedAt = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let request = 0

  /**
   * Fetches the stats of the selected range.
   * @returns {Promise<void>} - Resolves when stored or the error recorded
   */
  const refresh = async (): Promise<void> => {
    const current = ++request

    loading.value = true

    try {
      const next = await fetchStats(range.value)

      if (current === request) {
        data.value = next
        fetchedAt.value = Date.now()
        error.value = null
      }
    } catch (failure) {
      if (current === request) {
        error.value = errorMessage(failure)
      }
    } finally {
      if (current === request) {
        loading.value = false
      }
    }
  }

  /**
   * Fetches the stats unless they are loaded or loading.
   * @returns {Promise<void>} - Resolves when loaded
   */
  const ensureLoaded = async (): Promise<void> => {
    if (data.value === null && !loading.value) {
      await refresh()
    }
  }

  /**
   * Selects and remembers a history range and fetches it.
   * @param {StatsRange} next - Range
   * @returns {Promise<void>} - Resolves when the range is loaded
   */
  const setRange = async (next: StatsRange): Promise<void> => {
    if (next === range.value) {
      return
    }

    range.value = next
    storeRange(next)
    await refresh()
  }

  watch(
    () => dataVersion.version,
    () => {
      if (data.value !== null) {
        void refresh()
      }
    },
  )

  return { range, data, fetchedAt, loading, error, refresh, ensureLoaded, setRange }
})
