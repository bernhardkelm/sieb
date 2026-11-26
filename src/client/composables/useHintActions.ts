import { onScopeDispose } from 'vue'

import type { HintActions } from '@/keyboard/hintActions'
import { useHintActionsStore } from '@/stores/hintActionsStore'

/**
 * Registers the handlers behind the clickable shortcut hints for as long as the calling
 * component or effect scope lives.
 * @param {HintActions} actions - Handlers per action id, each running what its key runs
 * @param {() => Promise<void>} refocus - Focuses the cursor row of the view, omitted for global actions
 * @returns {void}
 */
export const useHintActions = (actions: HintActions, refocus?: () => Promise<void>): void => {
  const unregister = useHintActionsStore().register({ actions, refocus })

  onScopeDispose(unregister)
}
