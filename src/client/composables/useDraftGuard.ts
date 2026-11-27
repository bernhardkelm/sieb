import { onScopeDispose, ref, type Ref } from 'vue'
import { useRouter } from 'vue-router'

import { isDeepLinkUnload } from '@/router/deepLinkNavigation'
import { leavesFinding } from '@/router/findingNavigation'

export interface DraftGuard {
  /** Whether a navigation waits for the answer to the discard question */
  asking: Ref<boolean>
  /** Lets the waiting navigation proceed, which drops the draft */
  discard: () => void
  /** Cancels the waiting navigation, the draft stays */
  keep: () => void
}

/**
 * Guards an unsaved draft of the panel's decision form against every navigation that would
 * move the panel to another finding or close it: row clicks, view links and shortcuts, the
 * close button, browser back and forward. Such a navigation waits until `discard` or `keep`
 * answers; a newer one replaces the waiting one. Closing or reloading the tab asks through the
 * browser's own prompt.
 * @param {() => boolean} dirty - Whether the form holds input that leaving would discard
 * @returns {DraftGuard} - Question state and its answers
 */
export const useDraftGuard = (dirty: () => boolean): DraftGuard => {
  const router = useRouter()
  const asking = ref(false)
  let answer: ((proceed: boolean) => void) | null = null

  /**
   * Answers the waiting navigation.
   * @param {boolean} proceed - Whether the navigation proceeds
   * @returns {void}
   */
  const settle = (proceed: boolean): void => {
    const resolve = answer

    answer = null
    asking.value = false
    resolve?.(proceed)
  }

  const removeGuard = router.beforeEach((to, from) => {
    if (!dirty() || !leavesFinding(to, from)) {
      return true
    }

    answer?.(false)
    asking.value = true

    return new Promise<boolean>((resolve) => {
      answer = resolve
    })
  })

  /**
   * Asks the browser to confirm closing or reloading the tab while the draft is dirty, not for
   * a deep link that hands the page's work to Claude and leaves the page in place.
   * @param {BeforeUnloadEvent} event - Unload event
   * @returns {void}
   */
  const onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (dirty() && !isDeepLinkUnload()) {
      event.preventDefault()
    }
  }

  window.addEventListener('beforeunload', onBeforeUnload)

  onScopeDispose(() => {
    removeGuard()
    window.removeEventListener('beforeunload', onBeforeUnload)
    settle(true)
  })

  /**
   * Lets the waiting navigation proceed.
   * @returns {void}
   */
  const discard = (): void => {
    settle(true)
  }

  /**
   * Cancels the waiting navigation.
   * @returns {void}
   */
  const keep = (): void => {
    settle(false)
  }

  return { asking, discard, keep }
}
