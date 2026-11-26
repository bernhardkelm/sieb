import { useWindowKeydown } from '@/composables/useWindowKeydown'
import { isShortcutEvent, shortcutScope } from '@/keyboard/keyboardTarget'
import { useSyncStore } from '@/stores/syncStore'

/**
 * Triggers a sync when r is pressed outside text entries, popovers and dialogs.
 * @returns {void}
 */
export const useSyncShortcut = (): void => {
  const sync = useSyncStore()

  /**
   * Handles a global keydown.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {void}
   */
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'r' || !isShortcutEvent(event) || shortcutScope(event.target) === 'overlay') {
      return
    }

    event.preventDefault()
    void sync.sync()
  }

  useWindowKeydown(onKeydown)
}
