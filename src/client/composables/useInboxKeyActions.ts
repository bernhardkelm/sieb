import type { InboxItem } from '#core/inbox/inboxItem.ts'
import type { InboxBulk } from '@/composables/useInboxBulk'
import type { InboxPanels } from '@/composables/useInboxPanels'
import type { InboxAction } from '@/keyboard/inboxKeymap'

export interface InboxKeySources {
  /** Item under the cursor, undefined without one */
  current: () => InboxItem | undefined
  panels: InboxPanels
  bulk: InboxBulk
  markSeen: () => Promise<void>
  focusSearch: () => void
}

/**
 * Maps the Inbox key actions to what they run: open the cursor item in its panel, close the
 * topmost panel, open the bulk accept or reject, mark as seen, focus the search.
 * @param {InboxKeySources} sources - Cursor item, panels, bulk, mark and search actions
 * @returns {(action: InboxAction) => boolean} - Runs an action, true when it applied
 */
export const useInboxKeyActions = ({
  current,
  panels,
  bulk,
  markSeen,
  focusSearch,
}: InboxKeySources): ((action: InboxAction) => boolean) => {
  const actions: Record<InboxAction, () => boolean> = {
    open: () => {
      const item = current()

      if (item) {
        void panels.openItem(item)
      }

      return item !== undefined
    },
    close: () => panels.closeTop(),
    accept: () => {
      bulk.openAccept()
      return true
    },
    reject: () => {
      bulk.openReject()
      return true
    },
    markSeen: () => {
      void markSeen()
      return true
    },
    search: () => {
      focusSearch()
      return true
    },
  }

  return (action) => actions[action]()
}
