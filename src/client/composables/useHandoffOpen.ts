import { HANDOFF_CLIENTS, handoffLink } from '#core/handoffLinks.ts'
import type { HandoffPrompts } from '#core/handoffPrompt.ts'
import { useClipboardCopy } from '@/composables/useClipboardCopy'
import type { HandoffPreference } from '@/format/handoffTargets'
import { openDeepLink } from '@/router/deepLinkNavigation'
import { notifySuccess, notifyWithAction } from '@/toast/toastManager'

export interface HandoffOpen {
  /** Copies a prompt and confirms it with a toast, resolves whether it was copied */
  copyPrompt: (prompt: string) => Promise<boolean>
  /** Opens a client with its prompt prefilled, or copies the chat prompt for the copy preference */
  open: (preference: HandoffPreference, prompts: HandoffPrompts) => void
  /** Opens a deep link, the toast action runs the copy fallback in case nothing opens */
  openLink: (link: string, copyFallback: () => unknown) => void
}

/**
 * Hands a prompt over to a Claude client through its deep link. Browsers cannot tell whether a
 * handler for the scheme exists, so a toast offers copying the prompt in case nothing opens.
 * @returns {HandoffOpen} - Open and copy functions
 */
export const useHandoffOpen = (): HandoffOpen => {
  const { copy } = useClipboardCopy()

  /**
   * Copies a prompt and confirms it with a toast.
   * @param {string} prompt - Prompt
   * @param {string} title - Toast title
   * @returns {Promise<boolean>} - Whether the prompt was copied
   */
  const copyWithToast = async (prompt: string, title = 'Copied for Claude'): Promise<boolean> => {
    if (!(await copy(prompt))) {
      return false
    }

    notifySuccess(title, 'Paste the prompt into Claude.')
    return true
  }

  /**
   * Opens a deep link and offers the copy fallback in a toast, since nothing may handle it.
   * @param {string} link - Deep link
   * @param {() => unknown} copyFallback - Copies the prompt instead
   * @returns {void}
   */
  const openLink = (link: string, copyFallback: () => unknown): void => {
    openDeepLink(link)
    notifyWithAction(
      'handoff-open',
      'Opening Claude…',
      'If nothing happens, copy the prompt instead.',
      {
        label: 'Copy prompt',
        altText: 'Copy the prompt with h',
        onClick: () => {
          void copyFallback()
        },
      },
    )
  }

  /**
   * Opens the client of a preference with the prompt of its client kind, or copies the prompt
   * for copy, the chat one, and for prompts too long for a link.
   * @param {HandoffPreference} preference - Client or copy
   * @param {HandoffPrompts} prompts - Prompt per client kind
   * @returns {void}
   */
  const open = (preference: HandoffPreference, prompts: HandoffPrompts): void => {
    const prompt = prompts[preference === 'copy' ? 'chat' : HANDOFF_CLIENTS[preference]]
    const link = preference === 'copy' ? null : handoffLink(preference, prompt)

    if (preference === 'copy' || link === null) {
      void copyWithToast(prompt, preference === 'copy' ? undefined : 'Too long for a link, copied')
      return
    }

    openLink(link, () => copyWithToast(prompt))
  }

  return { copyPrompt: (prompt) => copyWithToast(prompt), open, openLink }
}
