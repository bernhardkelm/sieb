import { ref, type Ref } from 'vue'

import type { Decision } from '#core/decision.ts'
import { useDecisionCommands } from '@/composables/useDecisionCommands'

export interface DecisionCardActions {
  /** Decision the revoke dialog asks about, null while it is closed */
  revokeTarget: Ref<Decision | null>
  revoking: Ref<boolean>
  reconfirming: Ref<boolean>
  revoke: (comment: string) => Promise<void>
  reconfirm: (decision: Decision) => Promise<void>
}

/**
 * Runs the actions of the decision cards in the finding panel: revoking through the revoke
 * dialog and re-confirming a re-opened decision. Failures are toasted by the commands.
 * @param {() => void} onSaved - Runs after a re-confirm went through
 * @returns {DecisionCardActions} - Dialog target, busy flags and the actions
 */
export const useDecisionCardActions = (onSaved: () => void): DecisionCardActions => {
  const commands = useDecisionCommands()
  const revokeTarget = ref<Decision | null>(null)
  const revoking = ref(false)
  const reconfirming = ref(false)

  /**
   * Revokes the decision chosen in the dialog; the dialog stays open after a failure.
   * @param {string} comment - Optional comment
   * @returns {Promise<void>} - Resolves when revoked or failed
   */
  const revoke = async (comment: string): Promise<void> => {
    if (!revokeTarget.value) {
      return
    }

    revoking.value = true

    try {
      await commands.revoke(revokeTarget.value.id, comment)
      revokeTarget.value = null
    } catch {
      // failure toasted by the command, the dialog stays open for a retry
    } finally {
      revoking.value = false
    }
  }

  /**
   * Re-confirms a re-opened decision, so it takes effect again.
   * @param {Decision} decision - Re-opened decision
   * @returns {Promise<void>} - Resolves when re-confirmed or failed
   */
  const reconfirm = async (decision: Decision): Promise<void> => {
    reconfirming.value = true

    try {
      await commands.reconfirm(decision)
      onSaved()
    } catch {
      // failure toasted by the command
    } finally {
      reconfirming.value = false
    }
  }

  return { revokeTarget, revoking, reconfirming, revoke, reconfirm }
}
