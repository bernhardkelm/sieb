import { nextTick, watch, type Ref } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { findingIdOfItem, proposalItemKey } from '@/components/inbox/inboxItems'
import { useFindingPanel } from '@/composables/useFindingPanel'
import type { InboxPanels } from '@/composables/useInboxPanels'

export interface InboxCursorPanels {
  /** Puts the cursor on a clicked row and opens the row in its panel */
  openAt: (key: string, item: InboxItem) => Promise<void>
}

/**
 * Lets the Inbox panels react to a cursor that moved away from the row they show. A click on a
 * row opens that row, so the panel follows the click. A key move never opens a review: with the
 * review panel open it closes the review, onto a proposal row it closes the finding panel, both
 * returning focus to the cursor row; Enter opens the review deliberately. Between finding rows
 * the finding panel follows the cursor through the shared list cursor. A cursor that moved
 * because the shown row left the list, such as after an accept, leaves the panels alone.
 * @param {Ref<string | null>} currentKey - Cursor row
 * @param {Readonly<Ref<readonly InboxItem[]>>} items - Listed items
 * @param {InboxPanels} panels - Panel state and actions of the Inbox
 * @param {() => Promise<void>} refocus - Focuses the cursor row
 * @returns {InboxCursorPanels} - Click handler that opens a row
 */
export const useInboxCursorPanels = (
  currentKey: Ref<string | null>,
  items: Readonly<Ref<readonly InboxItem[]>>,
  panels: InboxPanels,
  refocus: () => Promise<void>,
): InboxCursorPanels => {
  const { findingId, closeFinding } = useFindingPanel()
  const known = new Map<string, InboxItem>()
  let clicked = false

  /**
   * Returns whether a panel shows a row.
   * @param {string | null} key - Row key
   * @returns {boolean} - True while the review or the finding panel shows it
   */
  const shown = (key: string | null): boolean => {
    if (key === null) {
      return false
    }

    const proposalId = panels.proposalId.value

    if (proposalId !== null && key === proposalItemKey(proposalId)) {
      return true
    }

    const item = known.get(key)

    return (
      findingId.value !== null &&
      item !== undefined &&
      findingIdOfItem(item) === Number(findingId.value)
    )
  }

  /**
   * Closes the finding panel and focuses the cursor row once the panel left.
   * @returns {Promise<void>} - Resolves once focused
   */
  const leaveFinding = async (): Promise<void> => {
    if (await closeFinding()) {
      await nextTick()
      await refocus()
    }
  }

  /**
   * Puts the cursor on a clicked row and opens it.
   * @param {string} key - Row key
   * @param {InboxItem} item - Item of the row
   * @returns {Promise<void>} - Resolves after the navigation
   */
  const openAt = (key: string, item: InboxItem): Promise<void> => {
    if (currentKey.value !== key) {
      clicked = true
      currentKey.value = key
    }

    return panels.openItem(item)
  }

  watch(
    items,
    (next) => {
      next.forEach((item) => known.set(item.key, item))
    },
    { immediate: true },
  )

  watch(currentKey, (key, previous) => {
    const byClick = clicked
    const item = key === null ? undefined : known.get(key)
    const stillListed = items.value.some((listed) => listed.key === previous)

    clicked = false

    if (byClick || item === undefined || !shown(previous) || !stillListed) {
      return
    }

    if (panels.proposalId.value !== null) {
      void panels.closeProposal()
    } else if (item.kind === 'proposal') {
      void leaveFinding()
    }
  })

  return { openAt }
}
