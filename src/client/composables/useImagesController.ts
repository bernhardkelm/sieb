import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue'

import { isNotAffectedFinding } from '#core/findingDecisionState.ts'
import type { FindingView } from '#core/findingView.ts'
import type { ImageAggregate } from '#core/imageAggregation.ts'
import { emptyAggregateFilters, type AggregateFilters } from '@/components/filters/aggregateFilters'
import { countHiddenImages, filterImages } from '@/components/images/imageFilters'
import { IMAGE_SORT_COLUMNS, sortImages, type ImageSortColumn } from '@/components/images/imageSort'
import { useCursorList } from '@/composables/useCursorList'
import { useExpandedGroup } from '@/composables/useExpandedGroup'
import { useHintActions } from '@/composables/useHintActions'
import { useListSort, type ListSort } from '@/composables/useListSort'
import { findingRowKey, groupRowKey } from '@/keyboard/rowKey'
import { IMAGE_QUERY } from '@/router/routeNames'
import { useFindingsStore } from '@/stores/findingsStore'
import { useImagesStore } from '@/stores/imagesStore'

export interface ImagesController {
  filters: Ref<AggregateFilters>
  images: ComputedRef<ImageAggregate[]>
  hiddenCount: ComputedRef<number>
  sort: ListSort<ImageSortColumn>
  resetSort: () => Promise<void>
  expandedRef: ComputedRef<string | null>
  expandedFindings: ComputedRef<FindingView[]>
  currentKey: Ref<string | null>
  select: (key: string) => void
}

/**
 * Drives the by-image view: filtered images in the sort of the `sort` and `dir` query params, the image expanded through the `image` query param
 * with its open findings, and the keyboard cursor over both. Not affected findings stay out of the
 * counts and the expanded findings until the showNotAffected filter brings them back.
 * @param {() => void} focusSearch - Focuses the search input
 * @returns {ImagesController} - State and actions for the view
 */
export const useImagesController = (focusSearch: () => void): ImagesController => {
  const store = useImagesStore()
  const findings = useFindingsStore()
  const filters = ref(emptyAggregateFilters())

  const sort = useListSort(IMAGE_SORT_COLUMNS)

  const images = computed(() =>
    sortImages(filterImages(store.items, filters.value), sort.sort.value),
  )
  const hiddenCount = computed(() => countHiddenImages(store.items, filters.value))
  const expanded = useExpandedGroup(IMAGE_QUERY)
  const expandedFindings = computed(() =>
    findings.items.filter(
      (finding) =>
        finding.imageRef === expanded.value.value &&
        finding.resolvedAt === null &&
        (filters.value.showNotAffected || !isNotAffectedFinding(finding)),
    ),
  )
  const keys = computed(() =>
    images.value.flatMap((image) => [
      groupRowKey(image.imageRef),
      ...(image.imageRef === expanded.value.value
        ? expandedFindings.value.map((finding) => findingRowKey(finding.id))
        : []),
    ]),
  )

  const cursor = useCursorList({
    keys,
    activateGroup: expanded.toggle,
    close: () => expanded.collapse(cursor.focusKey),
    expanded: () => expanded.value.value,
    focusSearch,
  })

  expanded.placeCursor(keys, cursor)

  useHintActions({ search: { run: focusSearch } }, cursor.refocus)

  /**
   * Returns to the default order and focuses the cursor row, as the reset button disappears.
   * @returns {Promise<void>} - Resolves once focused
   */
  const resetSort = async (): Promise<void> => {
    await sort.set(null)
    await cursor.refocus()
  }

  onMounted(() => {
    void store.ensureLoaded()
    void findings.ensureLoaded()
  })

  return {
    filters,
    images,
    hiddenCount,
    sort,
    resetSort,
    expandedRef: expanded.value,
    expandedFindings,
    currentKey: cursor.currentKey,
    select: cursor.select,
  }
}
