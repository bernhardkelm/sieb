import { computed, type ComputedRef } from 'vue'

import { useLabelsStore } from '@/stores/labelsStore'

export type LabelColumn = 'exposure' | 'owner' | 'kev'

export interface LabelColumns {
  hidden: ComputedRef<LabelColumn[]> // columns no open finding has a label for, kev without a KEV source
  classes: ComputedRef<Record<'no-exposure' | 'no-owner' | 'no-kev', boolean>> // grid variants of a list
}

/**
 * Returns which optional columns a list hides and the classes selecting its grid variant: label
 * columns no open finding has a label for, and the KEV column for the KEV source none.
 * @returns {LabelColumns} - Hidden columns and list classes
 */
export const useLabelColumns = (): LabelColumns => {
  const labels = useLabelsStore()

  return {
    hidden: computed(() => [
      ...(labels.showExposure ? [] : (['exposure'] as const)),
      ...(labels.showOwner ? [] : (['owner'] as const)),
      ...(labels.showKev ? [] : (['kev'] as const)),
    ]),
    classes: computed(() => ({
      'no-exposure': !labels.showExposure,
      'no-owner': !labels.showOwner,
      'no-kev': !labels.showKev,
    })),
  }
}
