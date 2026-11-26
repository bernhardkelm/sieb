import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue'

import type { DecisionStatus } from '#core/decision.ts'
import type { FindingView } from '#core/findingView.ts'
import { bulkTargetsFor, type BulkTarget } from '@/components/decision/bulkTargets'
import { INBOX_SORT_COLUMNS, sortInbox, type InboxSortColumn } from '@/components/inbox/inboxSort'
import { useFindingPanel } from '@/composables/useFindingPanel'
import { useListCursor } from '@/composables/useListCursor'
import { useListSort, type ListSort } from '@/composables/useListSort'
import { useNow } from '@/composables/useNow'
import { inboxActionFor, type InboxAction } from '@/keyboard/inboxKeymap'
import { isNewFinding } from '@/stores/findingFilters'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useFindingsStore } from '@/stores/findingsStore'

export interface InboxController {
  findings: ComputedRef<FindingView[]>
  sort: ListSort<InboxSortColumn>
  resetSort: () => Promise<void>
  newCount: ComputedRef<number>
  currentId: Ref<number | null>
  checkedIds: Ref<Set<number>>
  bulkOpen: Ref<boolean>
  bulkTargets: Ref<BulkTarget[]>
  select: (id: number) => void
  openBulk: () => void
  toggleChecked: (id: number) => void
  clearChecked: () => void
}

const ACTION_STATUS: Partial<Record<InboxAction, DecisionStatus>> = {
  accept: 'accepted',
  notAffected: 'not_affected',
  fixPlanned: 'fix_planned',
}

/**
 * Drives the inbox on the shared list cursor: cursor and checked rows over the filtered inbox in
 * the sort of the `sort` and `dir` query params, triage order by default, the inbox keymap, the side panel following the cursor and the bulk dialog. A panel opened by
 * link on a finding outside the inbox stays until j or k moves the cursor.
 * @param {() => void} focusSearch - Focuses the search input of the filter bar
 * @returns {InboxController} - State and actions for the inbox view
 */
export const useInboxController = (focusSearch: () => void): InboxController => {
  const store = useFindingsStore()
  const detail = useFindingDetailStore()
  const { findingId, openFinding, closeFinding } = useFindingPanel()
  const now = useNow()

  const sort = useListSort(INBOX_SORT_COLUMNS)

  const findings = computed(() => sortInbox(store.inbox, sort.sort.value))
  const ids = computed(() => findings.value.map((finding) => finding.id))
  const newCount = computed(
    () => findings.value.filter((finding) => isNewFinding(finding.firstSeen, now.value)).length,
  )
  const bulkOpen = ref(false)
  const bulkTargets = ref<BulkTarget[]>([])

  /**
   * Runs an inbox action.
   * @param {InboxAction} action - Action
   * @returns {void}
   */
  const run = (action: InboxAction): void => {
    const { selection } = cursor
    const id = cursor.currentKey.value

    switch (action) {
      case 'next':
      case 'previous':
        cursor.move(action === 'next' ? 1 : -1)
        return
      case 'open':
        if (id !== null) {
          void openFinding(String(id))
        }
        return
      case 'close':
        if (findingId.value !== null) {
          void closeFinding()
        } else {
          selection.clearChecked()
        }
        return
      case 'toggleCheck':
        if (id !== null) {
          selection.toggleChecked(id)
        }
        return
      case 'bulk':
        bulkTargets.value = bulkTargetsFor(findings.value, selection.checkedIds.value, id)
        bulkOpen.value = bulkTargets.value.length > 0
        return
      case 'search':
        focusSearch()
        return
      default: {
        const status = ACTION_STATUS[action]

        if (id !== null && status) {
          void openFinding(String(id))
          detail.requestDecision(id, status)
        }
      }
    }
  }

  const cursor = useListCursor<number>({
    keys: ids,
    findingIdOf: (id) => id,
    keyOfFinding: (id) => id,
    rowOf: (id) => document.querySelector<HTMLElement>(`[data-finding-id="${id}"]`),
    paused: () => bulkOpen.value,
    handleKey: (event, scope) => {
      const action = inboxActionFor(event, scope)

      if (action !== null) {
        run(action)
      }

      return action !== null
    },
  })

  /**
   * Puts the cursor on a row and opens it in the panel.
   * @param {number} id - Finding id
   * @returns {void}
   */
  const select = (id: number): void => {
    cursor.currentKey.value = id
    void openFinding(String(id))
  }

  /**
   * Opens the bulk dialog for the checked rows, as shift+A does.
   * @returns {void}
   */
  const openBulk = (): void => {
    run('bulk')
  }

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
  })

  return {
    findings,
    sort,
    resetSort,
    newCount,
    currentId: cursor.currentKey,
    checkedIds: cursor.selection.checkedIds,
    bulkOpen,
    bulkTargets,
    select,
    openBulk,
    toggleChecked: cursor.selection.toggleChecked,
    clearChecked: cursor.selection.clearChecked,
  }
}
