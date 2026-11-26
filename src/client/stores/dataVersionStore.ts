import { defineStore } from 'pinia'
import { readonly, ref } from 'vue'

/**
 * Counts changes of the server data, a finished sync or a decision written from this client.
 * Stores holding server data watch `version` and refetch when it moves.
 */
export const useDataVersionStore = defineStore('dataVersion', () => {
  const version = ref(0)

  /**
   * Marks the server data as changed.
   * @returns {void}
   */
  const bump = (): void => {
    version.value += 1
  }

  return { version: readonly(version), bump }
})
