import { computed, type ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  buildHandoffPrompt,
  handoffCommand,
  isOwnImage,
  type HandoffInput,
} from '#core/handoffPrompt.ts'
import { FINDING_QUERY, ROUTE_NAMES } from '@/router/routeNames'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

export const NO_FINDING_REASON = 'Open a finding first'
export const NOT_OWN_REASON = 'Only for own images'

export interface Handoff {
  /** Prompt for Claude, null while no finding detail is loaded */
  prompt: ComputedRef<string | null>
  /** claude command for own images, null otherwise */
  command: ComputedRef<string | null>
  /** Why the command cannot be copied, null while it can */
  commandBlockedBy: ComputedRef<string | null>
}

/**
 * Builds the hand-off texts of the finding shown in the side panel, linking back to it on the
 * current view.
 * @returns {Handoff} - Prompt, command and why the command is unavailable
 */
export const useHandoff = (): Handoff => {
  const store = useFindingDetailStore()
  const route = useRoute()
  const router = useRouter()

  const input = computed<HandoffInput | null>(() => {
    const detail = store.detail

    if (detail === null) {
      return null
    }

    const link = router.resolve({
      name: route.name ?? ROUTE_NAMES.INBOX,
      query: { [FINDING_QUERY]: String(detail.finding.id) },
    })

    return {
      finding: detail.finding,
      instances: detail.instances,
      url: new URL(link.href, window.location.origin).href,
    }
  })

  const prompt = computed(() => (input.value === null ? null : buildHandoffPrompt(input.value)))

  const command = computed(() =>
    input.value !== null && isOwnImage(input.value.finding) ? handoffCommand(input.value) : null,
  )

  const commandBlockedBy = computed(() => {
    if (input.value === null) {
      return NO_FINDING_REASON
    }

    return command.value === null ? NOT_OWN_REASON : null
  })

  return { prompt, command, commandBlockedBy }
}
