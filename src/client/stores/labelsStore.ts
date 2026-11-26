import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import type { LabelsResponse } from '#core/apiTypes.ts'
import { fetchLabels } from '@/api/labelsApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'

/**
 * Holds which optional labels the open findings carry and the KEV source of the server.
 * Exposure and owner columns, filters and chips show only while some open finding has the
 * label, and stay hidden until the first answer. KEV elements stay hidden while the first request
 * is pending, then show unless the server answers the KEV source none; a failed first request
 * shows them, since a KEV source is configured by default. Lists wait for `pending` to clear, so
 * columns do not jump in. The newest request wins, a failed refetch keeps the last answer, and
 * after the first load the labels refetch whenever the data version moves.
 */
export const useLabelsStore = defineStore('labels', () => {
  const dataVersion = useDataVersionStore()

  const data = ref<LabelsResponse | null>(null)
  const requested = ref(false)
  const failed = ref(false)
  let request = 0

  const pending = computed(() => requested.value && data.value === null && !failed.value)

  const showExposure = computed(() => data.value?.exposure ?? false)
  const owners = computed(() => data.value?.owners ?? [])
  const showOwner = computed(() => owners.value.length > 0)
  const kevSource = computed(() => data.value?.kev ?? null)
  const showKev = computed(() => !pending.value && kevSource.value !== 'none')

  /**
   * Fetches the labels, keeping the last answer when the request fails.
   * @returns {Promise<void>} - Resolves when stored or failed
   */
  const refresh = async (): Promise<void> => {
    const current = ++request

    requested.value = true

    try {
      const next = await fetchLabels()

      if (current === request) {
        data.value = next
      }
    } catch {
      // labels only hide optional columns, the next data version retries
      failed.value = true
    }
  }

  /**
   * Fetches the labels unless requested before.
   * @returns {Promise<void>} - Resolves when loaded
   */
  const ensureLoaded = async (): Promise<void> => {
    if (!requested.value) {
      await refresh()
    }
  }

  watch(
    () => dataVersion.version,
    () => {
      if (requested.value) {
        void refresh()
      }
    },
  )

  return {
    data,
    pending,
    showExposure,
    owners,
    showOwner,
    kevSource,
    showKev,
    refresh,
    ensureLoaded,
  }
})
