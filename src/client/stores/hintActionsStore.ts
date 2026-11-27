import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import {
  NOT_AVAILABLE_REASON,
  type HintAction,
  type HintActionId,
  type HintActions,
  type HintBulk,
} from '@/keyboard/hintActions'

export interface HintRegistration {
  actions: HintActions
  /** Focuses the cursor row of the view before an action runs, as after a key press */
  refocus?: () => Promise<void>
}

/**
 * Holds the actions behind the clickable shortcut hints. The active view and global features
 * register handlers for their keys, the sidebar and the touch selection bar run them by id; the
 * latest registration of an id wins, so a view mounting before the previous one unmounted
 * takes over at once.
 */
export const useHintActionsStore = defineStore('hintActions', () => {
  const registrations = shallowRef<HintRegistration[]>([])

  /**
   * Adds a registration.
   * @param {HintRegistration} registration - Actions and the optional refocus of the view
   * @returns {() => void} - Removes exactly this registration again
   */
  const register = (registration: HintRegistration): (() => void) => {
    registrations.value = [...registrations.value, registration]

    return () => {
      registrations.value = registrations.value.filter((entry) => entry !== registration)
    }
  }

  /**
   * Returns the latest registered handler of an action.
   * @param {HintActionId} id - Action id
   * @returns {HintAction | null} - Handler, null when nothing registered it
   */
  const actionOf = (id: HintActionId): HintAction | null =>
    [...registrations.value].reverse().find((entry) => entry.actions[id])?.actions[id] ?? null

  /**
   * Returns why an action cannot run now.
   * @param {HintActionId} id - Action id
   * @returns {string | null} - Reason, null while the action can run
   */
  const reasonOf = (id: HintActionId): string | null => {
    const action = actionOf(id)

    return action === null ? NOT_AVAILABLE_REASON : (action.blockedBy?.() ?? null)
  }

  /**
   * Returns the checked items an action acts on.
   * @param {HintActionId} id - Action id
   * @returns {HintBulk | null} - Count and noun, null while it acts on the cursor row or nothing registered it
   */
  const bulkOf = (id: HintActionId): HintBulk | null => actionOf(id)?.bulk?.() ?? null

  /**
   * Runs an action unless it is blocked, after focusing the cursor row of the view so dialogs
   * return focus there and the next key press acts on the list.
   * @param {HintActionId} id - Action id
   * @param {boolean} refocus - Whether to focus the cursor row first
   * @returns {Promise<boolean>} - Whether the action ran
   */
  const run = async (id: HintActionId, refocus = true): Promise<boolean> => {
    const action = actionOf(id)

    if (action === null || reasonOf(id) !== null) {
      return false
    }

    if (refocus) {
      await [...registrations.value]
        .reverse()
        .find((entry) => entry.refocus)
        ?.refocus?.()
    }

    action.run()
    return true
  }

  return { register, reasonOf, bulkOf, run }
})
