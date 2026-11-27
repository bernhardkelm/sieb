import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import type { SelectionHandoffFinding } from '#core/selectionHandoff.ts'

type SelectionSource = () => readonly SelectionHandoffFinding[]

/**
 * Holds the checked rows of the active list, the one source of the selection for the hand-off and
 * the Auto-check. Their keys, hints and buttons act on the checked rows while some are checked,
 * else on the panel finding; a list registers its source for as long as it is mounted, the latest
 * registration wins.
 */
export const useHandoffSelectionStore = defineStore('handoffSelection', () => {
  const sources = shallowRef<SelectionSource[]>([])

  const findings = computed<readonly SelectionHandoffFinding[]>(
    () => sources.value.at(-1)?.() ?? [],
  )
  const findingIds = computed<readonly number[]>(() => findings.value.map((finding) => finding.id))

  /**
   * Adds the checked rows of a list as the hand-off selection.
   * @param {SelectionSource} source - Returns the checked findings in list order
   * @returns {() => void} - Removes exactly this source again
   */
  const register = (source: SelectionSource): (() => void) => {
    sources.value = [...sources.value, source]

    return () => {
      sources.value = sources.value.filter((entry) => entry !== source)
    }
  }

  return { findings, findingIds, register }
})
