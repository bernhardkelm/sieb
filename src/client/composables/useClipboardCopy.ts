import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

import { notifyError } from '@/toast/toastManager'

const COPIED_MS = 1500

export interface ClipboardCopy {
  /** True for a moment after a successful copy */
  copied: Ref<boolean>
  copy: (text: string) => Promise<boolean>
}

/**
 * Writes texts to the clipboard and flags a successful copy for a moment, or raises an error
 * toast when the clipboard refuses.
 * @returns {ClipboardCopy} - Copied flag and copy function
 */
export const useClipboardCopy = (): ClipboardCopy => {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  /**
   * Copies a text to the clipboard.
   * @param {string} text - Text to write
   * @returns {Promise<boolean>} - Whether the clipboard took the text
   */
  const copy = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      notifyError('Could not copy to the clipboard', error)

      return false
    }

    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = false
    }, COPIED_MS)

    return true
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearTimeout(timer)
    })
  }

  return { copied, copy }
}
