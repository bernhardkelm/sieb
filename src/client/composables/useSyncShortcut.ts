import { useHintActions } from '@/composables/useHintActions'
import { useWindowKeydown } from '@/composables/useWindowKeydown'
import { isShortcutEvent, shortcutScope } from '@/keyboard/keyboardTarget'
import { useSyncStore } from '@/stores/syncStore'

/**
 * Triggers a sync when r is pressed outside text entries, popovers and dialogs, or its hint is
 * clicked; a running sync blocks the hint as it makes the store ignore the key.
 * @returns {void}
 */
export const useSyncShortcut = (): void => {
  const sync = useSyncStore()

  /**
   * Starts a sync.
   * @returns {void}
   */
  const runSync = (): void => {
    void sync.sync()
  }

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
    runSync()
  }

  useWindowKeydown(onKeydown)
  useHintActions({
    sync: { run: runSync, blockedBy: () => (sync.running ? 'A sync is running' : null) },
  })
}
