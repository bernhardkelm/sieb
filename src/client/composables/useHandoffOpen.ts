import { HANDOFF_CLIENTS, handoffLink } from '#core/handoffLinks.ts'
import type { HandoffPrompts } from '#core/handoffPrompt.ts'
import { useClipboardCopy } from '@/composables/useClipboardCopy'
import type { HandoffPreference } from '@/format/handoffTargets'
import { notifySuccess, notifyWithAction } from '@/toast/toastManager'

export interface HandoffOpen {
  /** Copies a prompt and confirms it with a toast, resolves whether it was copied */
  copyPrompt: (prompt: string) => Promise<boolean>
  /** Opens a client with its prompt prefilled, or copies the chat prompt for the copy preference */
  open: (preference: HandoffPreference, prompts: HandoffPrompts) => void
}

/**
 * Opens a hand-off deep link without leaving sieb, a custom scheme goes to the operating system
 * instead of replacing the page.
 * @param {string} link - Deep link
 * @returns {void}
 */
const openLink = (link: string): void => {
  window.location.assign(link)
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
   * Opens the client of a preference with the prompt of its client kind, or copies the prompt
   * for copy, the chat one, and for prompts too long for a link.
   * @param {HandoffPreference} preference - Client or copy
   * @param {HandoffPrompts} prompts - Prompt per client kind
   * @returns {void}
   */
  const open = (preference: HandoffPreference, prompts: HandoffPrompts): void => {
    const prompt = prompts[preference === 'copy' ? 'chat' : HANDOFF_CLIENTS[preference]]
    const link = preference === 'copy' ? null : handoffLink(preference, prompt)

    if (link === null) {
      void copyWithToast(prompt, preference === 'copy' ? undefined : 'Too long for a link, copied')
      return
    }

    openLink(link)
    notifyWithAction(
      'handoff-open',
      'Opening Claude…',
      'If nothing happens, copy the prompt instead.',
      {
        label: 'Copy prompt',
        altText: 'Copy the prompt with h',
        onClick: () => {
          void copyWithToast(prompt)
        },
      },
    )
  }

  return { copyPrompt: (prompt) => copyWithToast(prompt), open }
}
