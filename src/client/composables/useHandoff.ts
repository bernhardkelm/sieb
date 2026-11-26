import { computed, type ComputedRef } from 'vue'
import { useRoute, useRouter, type RouteRecordNameGeneric } from 'vue-router'

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

const INBOX_VIEWS: readonly unknown[] = [ROUTE_NAMES.INBOX, ROUTE_NAMES.INBOX_PROPOSAL]

/**
 * Returns the view a hand-off link opens the finding on: the current one, Triage from the
 * Inbox, whose finding links a fresh page load sends to Triage anyway.
 * @param {RouteRecordNameGeneric | undefined} name - Name of the current route
 * @returns {RouteRecordNameGeneric} - Route name of the link
 */
const linkViewOf = (name: RouteRecordNameGeneric | undefined): RouteRecordNameGeneric =>
  name === undefined || name === null || INBOX_VIEWS.includes(name) ? ROUTE_NAMES.TRIAGE : name

/**
 * Builds the hand-off texts of the finding shown in the side panel, linking back to it on the
 * current view, on Triage from the Inbox.
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
      name: linkViewOf(route.name),
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
