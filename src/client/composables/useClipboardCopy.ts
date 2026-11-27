import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

import { notifyError, notifySuccess } from '@/toast/toastManager'

const COPIED_MS = 1500

export interface ClipboardCopy {
  /** True for a moment after a successful copy */
  copied: Ref<boolean>
  copy: (text: string) => Promise<boolean>
  /** Copies a text and confirms it with a success toast, for keys and hints without a button */
  copyWithNotice: (text: string, title: string, description: string) => Promise<boolean>
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

  /**
   * Copies a text and confirms it with a success toast.
   * @param {string} text - Text to write
   * @param {string} title - Toast title
   * @param {string} description - Toast description
   * @returns {Promise<boolean>} - Whether the clipboard took the text
   */
  const copyWithNotice = async (
    text: string,
    title: string,
    description: string,
  ): Promise<boolean> => {
    if (!(await copy(text))) {
      return false
    }

    notifySuccess(title, description)
    return true
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearTimeout(timer)
    })
  }

  return { copied, copy, copyWithNotice }
}
