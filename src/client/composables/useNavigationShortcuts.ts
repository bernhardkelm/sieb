import { useRouter } from 'vue-router'

import { useWindowKeydown } from '@/composables/useWindowKeydown'
import { isShortcutEvent, shortcutScope } from '@/keyboard/keyboardTarget'
import { NAV_ITEMS } from '@/router/navItems'

/**
 * Navigates to a view when its single-key shortcut from NAV_ITEMS is pressed outside text entries,
 * keeping the open finding panel closed on the new view.
 * @returns {void}
 */
export const useNavigationShortcuts = (): void => {
  const router = useRouter()

  /**
   * Handles a global keydown.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {void}
   */
  const onKeydown = (event: KeyboardEvent): void => {
    if (!isShortcutEvent(event) || shortcutScope(event.target) === 'overlay') {
      return
    }

    const item = NAV_ITEMS.find((candidate) => candidate.shortcut === event.key)

    if (!item) {
      return
    }

    event.preventDefault()
    void router.push({ name: item.name })
  }

  useWindowKeydown(onKeydown)
}
