import { useRouter } from 'vue-router'

import { useFeatures } from '@/composables/useFeatures'
import { useWindowKeydown } from '@/composables/useWindowKeydown'
import { isShortcutEvent, shortcutScope } from '@/keyboard/keyboardTarget'
import { navItemsFor } from '@/router/navItems'

/**
 * Navigates to a view when its single-key shortcut from NAV_ITEMS is pressed outside text entries,
 * keeping the open finding panel closed on the new view. The Checks key works only while
 * Auto-check is on, as the sidebar lists the view only then.
 * @returns {void}
 */
export const useNavigationShortcuts = (): void => {
  const router = useRouter()
  const features = useFeatures()

  /**
   * Handles a global keydown.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {void}
   */
  const onKeydown = (event: KeyboardEvent): void => {
    if (!isShortcutEvent(event) || shortcutScope(event.target) === 'overlay') {
      return
    }

    const item = navItemsFor(features.value).find((candidate) => candidate.shortcut === event.key)

    if (!item) {
      return
    }

    event.preventDefault()
    void router.push({ name: item.name })
  }

  useWindowKeydown(onKeydown)
}
