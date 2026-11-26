import type { Ref } from 'vue'

import type { ListCursor } from '@/composables/useListCursor'
import { useHintActions } from '@/composables/useHintActions'
import type { HintAction } from '@/keyboard/hintActions'
import type { InboxAction } from '@/keyboard/inboxKeymap'

export interface InboxHintSources {
  /** Runs an inbox key action, the handler behind a, n, f and / */
  run: (action: InboxAction) => void
  cursor: ListCursor<number>
  ids: Readonly<Ref<readonly number[]>>
}

const NO_CURSOR = 'No finding under the cursor'

/**
 * Registers the inbox hint actions: Accept, Not affected and Fix planned decide the checked rows
 * or the cursor row as a, n and f do, Select and Select all check rows as x and the select-all
 * chord do, Search focuses the search input as / does.
 * @param {InboxHintSources} sources - Key handler, cursor and listed rows of the inbox
 * @returns {void}
 */
export const useInboxHintActions = ({ run, cursor, ids }: InboxHintSources): void => {
  /**
   * Returns why the cursor row cannot be acted on.
   * @returns {string | null} - Reason, null with a cursor row
   */
  const noCursor = (): string | null => (cursor.currentKey.value === null ? NO_CURSOR : null)

  /**
   * Builds a decision action, available with checked rows or a cursor row.
   * @param {InboxAction} action - Decision key action
   * @returns {HintAction} - Hint action
   */
  const decide = (action: InboxAction): HintAction => ({
    run: () => run(action),
    blockedBy: () => (cursor.selection.checkedIds.value.size > 0 ? null : noCursor()),
  })

  useHintActions(
    {
      accept: decide('accept'),
      notAffected: decide('notAffected'),
      fixPlanned: decide('fixPlanned'),
      toggle: { run: cursor.toggleCurrent, blockedBy: noCursor },
      selectAll: {
        run: cursor.selection.checkAll,
        blockedBy: () => (ids.value.length === 0 ? 'No findings listed' : null),
      },
      search: { run: () => run('search') },
    },
    cursor.refocus,
  )
}
