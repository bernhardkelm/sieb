import { computed, type ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { readQueryParam, withQueryParam } from '@/router/queryParam'

export interface QueryParam {
  value: ComputedRef<string | null>
  set: (value: string | null) => Promise<void>
}

/**
 * Binds a single query param, so view state such as an expanded row stays linkable. Changes
 * replace the history entry and keep every other param.
 * @param {string} key - Param name
 * @returns {QueryParam} - Current value and its setter
 */
export const useQueryParam = (key: string): QueryParam => {
  const route = useRoute()
  const router = useRouter()

  const value = computed(() => readQueryParam(route.query, key))

  /**
   * Sets or removes the param.
   * @param {string | null} next - New value, null removes it
   * @returns {Promise<void>} - Resolves after navigation
   */
  const set = async (next: string | null): Promise<void> => {
    if (next !== value.value) {
      await router.replace({ query: withQueryParam(route.query, key, next) })
    }
  }

  return { value, set }
}
