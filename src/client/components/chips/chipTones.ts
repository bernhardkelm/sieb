import type { CheckState } from '#core/check.ts'
import type { EffectiveDecision } from '#core/effectiveDecision.ts'
import type { Exposure } from '#core/exposure.ts'
import type { InboxKind } from '#core/inbox/inboxItem.ts'
import type { ProposalConfidence, ProposalVerdict } from '#core/proposal.ts'
import type { ChipTone, ChipVariant } from '@/components/chips/chipTone'

export interface ChipLook {
  tone: ChipTone
  variant: ChipVariant
}

/** Proposals are Claude's and take the claim colour wherever an Inbox item renders */
export const INBOX_KIND_TONES: Record<InboxKind, ChipTone> = {
  proposal: 'claim',
  reopened: 'danger',
  expiring: 'warning',
  kev: 'kev',
}

export const CHECK_STATE_LOOKS: Record<CheckState, ChipLook> = {
  queued: { tone: 'neutral', variant: 'outline' },
  running: { tone: 'claim', variant: 'framed' },
  done: { tone: 'success', variant: 'wash' },
  failed: { tone: 'danger', variant: 'wash' },
  cancelled: { tone: 'neutral', variant: 'outline' },
}

export const VERDICT_TONES: Record<ProposalVerdict, ChipTone> = {
  not_affected: 'success',
  accepted: 'warning',
  fix_planned: 'accent',
  needs_patch: 'danger',
  inconclusive: 'neutral',
}

export const CONFIDENCE_TONES: Record<ProposalConfidence, ChipTone> = {
  low: 'danger',
  medium: 'warning',
  high: 'success',
}

export const EXPOSURE_LOOKS: Record<Exposure, ChipLook> = {
  public: { tone: 'warning', variant: 'wash' },
  gated: { tone: 'neutral', variant: 'outline' },
  internal: { tone: 'neutral', variant: 'outline' },
}

export const DECISION_STATE_TONES: Record<EffectiveDecision['state'], ChipTone> = {
  active: 'success',
  fix_planned: 'accent',
  expired: 'warning',
  revoked: 'neutral',
  reopened: 'danger',
}
