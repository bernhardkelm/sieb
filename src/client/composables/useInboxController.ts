import { computed, onMounted, type ComputedRef, type Ref } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { findingIdOfItem } from '@/components/inbox/inboxItems'
import { useCursorRefocus } from '@/composables/useCursorRefocus'
import { useInboxHintActions } from '@/composables/useInboxHintActions'
import { useInboxPanels } from '@/composables/useInboxPanels'
import { useInboxSeen } from '@/composables/useInboxSeen'
import { useListCursor } from '@/composables/useListCursor'
import { inboxActionFor, type InboxAction } from '@/keyboard/inboxKeymap'
import { rowClickIntent } from '@/keyboard/rowClick'
import { useInboxStore } from '@/stores/inboxStore'

export interface InboxController {
  items: ComputedRef<InboxItem[]>
  currentKey: Ref<string | null>
  checkedKeys: Ref<Set<string>>
  proposalId: ComputedRef<number | null>
  /** Items s marks as seen: the checked ones, else the cursor item when it can be seen */
  seenTargets: ComputedRef<string[]>
  select: (key: string, event?: MouseEvent) => void
  toggleChecked: (key: string, event?: MouseEvent) => void
  markSeen: (keys?: readonly string[]) => Promise<void>
  clearChecked: () => void
  closeProposal: () => Promise<void>
  onResolved: () => Promise<void>
}

/**
 * Drives the Inbox on the shared list cursor: j and k move, Enter or o opens the cursor item in
 * its panel, Escape closes the topmost panel, Space, x and the Shift and modifier clicks check
 * the items that can be marked as seen, and s marks the checked items, or the cursor item, as
 * seen. A resolved proposal closes the review panel and refetches the Inbox, focus lands on the
 * next row and the next review opens only on Enter or a click.
 * @returns {InboxController} - State and actions for the Inbox view
 */
export const useInboxController = (): InboxController => {
  const store = useInboxStore()

  const items = computed(() => store.items)
  const keys = computed(() => items.value.map((item) => item.key))
  const byKey = computed(() => new Map(items.value.map((item) => [item.key, item])))

  /**
   * Returns the rendered row of an item.
   * @param {string} key - Item key
   * @returns {HTMLElement | null} - Row element, null while not rendered
   */
  const rowOf = (key: string): HTMLElement | null =>
    document.querySelector<HTMLElement>(`[data-inbox-key="${CSS.escape(key)}"]`)

  const cursor = useListCursor<string>({
    keys,
    findingIdOf: (key) => {
      const item = byKey.value.get(key)

      return item ? findingIdOfItem(item) : null
    },
    keyOfFinding: (id) => items.value.find((item) => findingIdOfItem(item) === id)?.key ?? '',
    rowOf,
    multiselect: true,
    handleKey: (event, scope) => {
      const action = inboxActionFor(event, scope)

      return action !== null && run(action)
    },
  })

  const { currentKey, selection } = cursor
  const panels = useInboxPanels(currentKey, items, cursor.refocus)
  const refocusCursor = useCursorRefocus(currentKey, rowOf)

  const { seenTargets, markSeen } = useInboxSeen(selection, byKey)

  /**
   * Runs an Inbox key action.
   * @param {InboxAction} action - Action
   * @returns {boolean} - Whether the action applied
   */
  const run = (action: InboxAction): boolean => {
    const item = currentKey.value === null ? undefined : byKey.value.get(currentKey.value)

    switch (action) {
      case 'open':
        if (item) {
          void panels.openItem(item)
        }
        return item !== undefined
      case 'close':
        return panels.closeTop()
      case 'markSeen':
        void markSeen()
        return true
    }

    return false
  }

  /**
   * Handles a click on a row: Shift checks the range from the anchor, Cmd or Ctrl checks or
   * unchecks the row, a plain click puts the cursor on the row and opens it.
   * @param {string} key - Item key
   * @param {MouseEvent | undefined} event - Click
   * @returns {void}
   */
  const select = (key: string, event?: MouseEvent): void => {
    const item = byKey.value.get(key)

    if (cursor.click(key, event) || !item) {
      return
    }

    currentKey.value = key
    void panels.openItem(item)
  }

  /**
   * Handles a click on the checkbox of a row, as in Triage.
   * @param {string} key - Item key
   * @param {MouseEvent | undefined} event - Click
   * @returns {void}
   */
  const toggleChecked = (key: string, event?: MouseEvent): void => {
    if (rowClickIntent(event, true) === 'range') {
      cursor.click(key, event)
    } else {
      selection.toggleChecked(key)
      refocusCursor()
    }
  }

  /**
   * Closes the review panel after a proposal was accepted or rejected, refetches the Inbox and
   * focuses the cursor row, which moved to the next row once the resolved one left.
   * @returns {Promise<void>} - Resolves once focused
   */
  const onResolved = async (): Promise<void> => {
    await panels.closeProposal()
    await store.refresh()
    await cursor.refocus()
  }

  useInboxHintActions({ cursor, items: byKey, seenTargets, markSeen })

  onMounted(() => {
    void store.ensureLoaded()
  })

  return {
    items,
    currentKey,
    checkedKeys: selection.checkedIds,
    proposalId: panels.proposalId,
    seenTargets,
    select,
    toggleChecked,
    markSeen,
    clearChecked: selection.clearChecked,
    closeProposal: panels.closeProposal,
    onResolved,
  }
}
