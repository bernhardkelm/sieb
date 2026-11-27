import { defineStore } from 'pinia'
import { computed } from 'vue'

import {
  buildHandoffPrompts,
  handoffCommand,
  isOwnImage,
  type HandoffInput,
  type HandoffPrompts,
} from '#core/handoffPrompt.ts'
import { NO_FINDING_REASON, NOT_OWN_REASON } from '@/format/handoffReasons'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

/**
 * Builds the hand-off texts of the finding shown in the side panel once, for the button, the keys
 * and the hints alike.
 */
export const usePanelHandoffStore = defineStore('panelHandoff', () => {
  const detail = useFindingDetailStore()

  const input = computed<HandoffInput | null>(() =>
    detail.detail === null
      ? null
      : { finding: detail.detail.finding, instances: detail.detail.instances },
  )

  const prompts = computed<HandoffPrompts | null>(() =>
    input.value === null ? null : buildHandoffPrompts(input.value),
  )

  const command = computed<string | null>(() =>
    input.value !== null && isOwnImage(input.value.finding) ? handoffCommand(input.value) : null,
  )

  const commandBlockedBy = computed<string | null>(() => {
    if (input.value === null) {
      return NO_FINDING_REASON
    }

    return command.value === null ? NOT_OWN_REASON : null
  })

  return { prompts, command, commandBlockedBy }
})
