import { computed, type ComputedRef } from 'vue'

import { findingCheckBlocker } from '#core/checkEligibility.ts'
import type { ProposalDetail } from '#core/proposalApiTypes.ts'
import {
  buildHandoffPrompts,
  handoffCommand,
  isOwnImage,
  type HandoffPrompts,
} from '#core/handoffPrompt.ts'
import {
  handoffInputOf,
  recheckImages,
  type RecheckImage,
} from '@/components/proposals/recheckTargets'
import { useAutoCheck } from '@/composables/useAutoCheck'
import { availabilityReason, findingCheckReason } from '@/format/checkBlockReason'
import { useChecksStore } from '@/stores/checksStore'

/** Hand-off texts of the first target image, for a re-check without Auto-check */
export interface RecheckHandoff {
  prompts: HandoffPrompts
  command: string | null
}

export interface ProposalRecheck {
  /** auto queues Auto-checks, handoff offers the hand-off button, null without an open target */
  mode: ComputedRef<'auto' | 'handoff' | null>
  /** Why no Auto-check can be queued now, null while one can */
  blockedBy: ComputedRef<string | null>
  /** Whether a create request is in flight */
  submitting: ComputedRef<boolean>
  /** Hand-off texts for mode handoff, null otherwise */
  handoff: ComputedRef<RecheckHandoff | null>
  /** Queues the target findings without an open check, false while blocked */
  run: () => Promise<boolean>
}

/**
 * Returns whether Auto-check may reach a target image, as the side panel decides: public,
 * covered by a registry credential, or an own image sieb probes when the check is queued.
 * @param {RecheckImage} image - Target image with an open finding
 * @returns {boolean} - True when an Auto-check can be queued for it
 */
const isReachable = (image: RecheckImage): boolean =>
  findingCheckBlocker({
    resolved: false,
    visibility: image.imageVisibility,
    ownership: image.ownership,
  }) !== 'not_public'

/**
 * Re-checks the target findings of a proposal: with Auto-check switched on and a target image
 * it reaches, public or through a registry credential, it queues Auto-checks of the open target
 * findings with such images, with the block reasons of every Auto-check; else it hands the
 * first open target finding over to Claude.
 * @param {() => ProposalDetail} detail - Getter of the reviewed proposal
 * @returns {ProposalRecheck} - Mode, block reason, in-flight state, hand-off texts and run
 */
export const useProposalRecheck = (detail: () => ProposalDetail): ProposalRecheck => {
  const checks = useChecksStore()
  const { submitting, submit } = useAutoCheck()

  const images = computed(() => recheckImages(detail()))
  const reachable = computed(() => images.value.filter(isReachable))
  const queueable = computed(() =>
    reachable.value.filter((image) => checks.openFor(image.findingId) === null),
  )

  const mode = computed(() => {
    if (images.value.length === 0) {
      return null
    }

    return checks.enabled && reachable.value.length > 0 ? 'auto' : 'handoff'
  })

  const blockedBy = computed(() => {
    const [first] = reachable.value

    if (queueable.value.length > 0 || first === undefined) {
      return availabilityReason({ enabled: checks.enabled, workerOnline: checks.workerOnline })
    }

    return findingCheckReason({
      enabled: checks.enabled,
      workerOnline: checks.workerOnline,
      visibility: first.imageVisibility,
      ownership: first.ownership,
      resolved: false,
      open: checks.openFor(first.findingId),
      ...(first.checkAccess === undefined ? {} : { checkAccess: [first.checkAccess] }),
    })
  })

  const handoff = computed(() => {
    const [first] = images.value

    if (mode.value !== 'handoff' || first === undefined) {
      return null
    }

    const input = handoffInputOf(detail().proposal.vulnId, first)

    return {
      prompts: buildHandoffPrompts(input),
      command: isOwnImage(input.finding) ? handoffCommand(input) : null,
    }
  })

  /**
   * Queues Auto-checks of the queueable target findings unless blocked or a request is in flight.
   * @returns {Promise<boolean>} - Whether a check was queued
   */
  const run = async (): Promise<boolean> => {
    if (mode.value !== 'auto' || blockedBy.value !== null) {
      return false
    }

    return submit(queueable.value.map((image) => image.findingId))
  }

  return {
    mode,
    blockedBy,
    submitting: computed(() => submitting.value),
    handoff,
    run,
  }
}
