import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import type { LabelsResponse } from '#core/apiTypes.ts'
import { fetchLabels } from '@/api/labelsApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'

/**
 * Holds which optional labels the open findings carry and the KEV source of the server.
 * Exposure and owner columns, filters and chips show only while some open finding has the
 * label, and stay hidden until the first answer. KEV elements show unless the server answers the
 * KEV source none, since a KEV source is configured by default. The newest request wins, a
 * failed refetch keeps the last answer, and after the first load the labels refetch whenever the
 * data version moves.
 */
export const useLabelsStore = defineStore('labels', () => {
  const dataVersion = useDataVersionStore()

  const data = ref<LabelsResponse | null>(null)
  const requested = ref(false)
  let request = 0

  const showExposure = computed(() => data.value?.exposure ?? false)
  const owners = computed(() => data.value?.owners ?? [])
  const showOwner = computed(() => owners.value.length > 0)
  const kevSource = computed(() => data.value?.kev ?? null)
  const showKev = computed(() => kevSource.value !== 'none')

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

  return { data, showExposure, owners, showOwner, kevSource, showKev, refresh, ensureLoaded }
})
