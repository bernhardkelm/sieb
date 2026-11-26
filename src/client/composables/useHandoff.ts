import { computed, type ComputedRef } from 'vue'

import {
  buildHandoffPrompts,
  handoffCommand,
  isOwnImage,
  type HandoffInput,
  type HandoffPrompts,
} from '#core/handoffPrompt.ts'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

export const NO_FINDING_REASON = 'Open a finding first'
export const NOT_OWN_REASON = 'Only for own images'

export interface Handoff {
  /** Prompts for Claude chat and Claude Code, null while no finding detail is loaded */
  prompts: ComputedRef<HandoffPrompts | null>
  /** claude command for own images, null otherwise */
  command: ComputedRef<string | null>
  /** Why the command cannot be copied, null while it can */
  commandBlockedBy: ComputedRef<string | null>
}

/**
 * Builds the hand-off texts of the finding shown in the side panel.
 * @returns {Handoff} - Prompts, command and why the command is unavailable
 */
export const useHandoff = (): Handoff => {
  const store = useFindingDetailStore()

  const input = computed<HandoffInput | null>(() =>
    store.detail === null
      ? null
      : { finding: store.detail.finding, instances: store.detail.instances },
  )

  const prompts = computed(() => (input.value === null ? null : buildHandoffPrompts(input.value)))

  const command = computed(() =>
    input.value !== null && isOwnImage(input.value.finding) ? handoffCommand(input.value) : null,
  )

  const commandBlockedBy = computed(() => {
    if (input.value === null) {
      return NO_FINDING_REASON
    }

    return command.value === null ? NOT_OWN_REASON : null
  })

  return { prompts, command, commandBlockedBy }
}
