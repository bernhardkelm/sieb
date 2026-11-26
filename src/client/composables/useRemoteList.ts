import { ref, watch, type Ref } from 'vue'

import { errorMessage } from '@/api/apiRequest'
import { useDataVersionStore } from '@/stores/dataVersionStore'

export interface RemoteList<T> {
  items: Ref<T[]>
  loading: Ref<boolean>
  loaded: Ref<boolean>
  error: Ref<string | null>
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
}

/**
 * Holds a list fetched from the API inside a setup store: the newest refresh wins over older
 * ones still in flight, a failed refresh keeps the last items, and a loaded list refetches
 * whenever the data version moves.
 * @param {() => Promise<T[]>} fetchItems - Fetches the list
 * @param {() => void} onLoaded - Runs after each stored answer
 * @returns {RemoteList<T>} - List state and its loaders
 */
export const useRemoteList = <T>(
  fetchItems: () => Promise<T[]>,
  onLoaded: () => void = () => {},
): RemoteList<T> => {
  const dataVersion = useDataVersionStore()

  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)
  let request = 0

  /**
   * Fetches the list.
   * @returns {Promise<void>} - Resolves when stored or the error recorded
   */
  const refresh = async (): Promise<void> => {
    const current = ++request

    loading.value = true

    try {
      const next = await fetchItems()

      if (current === request) {
        items.value = next
        error.value = null
        loaded.value = true
        onLoaded()
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
   * Fetches the list unless it is loaded or loading.
   * @returns {Promise<void>} - Resolves when loaded
   */
  const ensureLoaded = async (): Promise<void> => {
    if (!loaded.value && !loading.value) {
      await refresh()
    }
  }

  watch(
    () => dataVersion.version,
    () => {
      if (loaded.value) {
        void refresh()
      }
    },
  )

  return { items, loading, loaded, error, refresh, ensureLoaded }
}
