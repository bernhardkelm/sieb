import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'

import type { HandoffPrompts } from '#core/handoffPrompt.ts'
import { usePanelHandoffStore } from '@/stores/panelHandoffStore'

export interface Handoff {
  /** Prompts for Claude chat and Claude Code, null while no finding detail is loaded */
  prompts: Readonly<Ref<HandoffPrompts | null>>
  /** claude command for own images, null otherwise */
  command: Readonly<Ref<string | null>>
  /** Why the command cannot be copied, null while it can */
  commandBlockedBy: Readonly<Ref<string | null>>
}

/**
 * Returns the hand-off texts of the finding shown in the side panel, built once in the store.
 * @returns {Handoff} - Prompts, command and why the command is unavailable
 */
export const useHandoff = (): Handoff => {
  const { prompts, command, commandBlockedBy } = storeToRefs(usePanelHandoffStore())

  return { prompts, command, commandBlockedBy }
}
