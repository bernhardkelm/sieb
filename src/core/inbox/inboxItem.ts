import type { DecisionStatus } from '#core/decision.ts'
import type { ReopenReason } from '#core/effectiveDecision.ts'
import type { Finding } from '#core/finding.ts'
import type { ProposalConfidence, ProposalVerdict } from '#core/proposal.ts'
import type { Severity } from '#core/severity.ts'

export const INBOX_KINDS = ['proposal', 'reopened', 'expiring', 'kev'] as const

export type InboxKind = (typeof INBOX_KINDS)[number]

/** Kinds a user can mark as seen, proposals and re-opened decisions leave by being handled */
export const SEEABLE_INBOX_KINDS = ['expiring', 'kev'] as const satisfies readonly InboxKind[]

export type SeeableInboxKind = (typeof SEEABLE_INBOX_KINDS)[number]

/** Expiring decisions and new KEV listings stay in the Inbox this many days */
export const INBOX_WINDOW_DAYS = 14

/** Open proposal as the Inbox needs it */
export interface InboxProposal {
  id: number
  vulnId: string
  imageRefs: string[] | null // null targets every affected image
  createdAt: string
  verdict: ProposalVerdict
  confidence: ProposalConfidence
}

/** Open finding as the Inbox needs it */
export type InboxFinding = Pick<
  Finding,
  'id' | 'vulnId' | 'imageRef' | 'severity' | 'kev' | 'title' | 'resolvedAt'
> & { kevSince: string | null }

/** Fields every Inbox row shows */
interface InboxItemBase {
  key: string // stable identity, also what POST /api/inbox/seen takes
  at: string // proposal createdAt, reopenedAt, expiresAt or kevSince
  vulnId: string
  imageRef: string | null // null for a decision on every image or a proposal on several
  severity: Severity // highest of the open findings the item covers
  kev: boolean // some covered open finding is KEV listed
  title: string | null // advisory title of a covered finding
  url: string // absolute sieb link that opens the item
}

export interface ProposalInboxItem extends InboxItemBase {
  kind: 'proposal'
  refs: { proposalId: number }
  verdict: ProposalVerdict
  confidence: ProposalConfidence
  imageCount: number // open findings the proposal covers
}

export interface ReopenedInboxItem extends InboxItemBase {
  kind: 'reopened'
  refs: { decisionId: number; findingId: number | null }
  decisionStatus: DecisionStatus
  reopenReason: ReopenReason
}

export interface ExpiringInboxItem extends InboxItemBase {
  kind: 'expiring'
  refs: { decisionId: number; findingId: number | null }
  decisionStatus: DecisionStatus
}

export interface KevInboxItem extends InboxItemBase {
  kind: 'kev'
  refs: { findingId: number; decisionId: number | null } // governing decision, null when undecided
  decisionStatus: DecisionStatus | null
}

export type InboxItem = ProposalInboxItem | ReopenedInboxItem | ExpiringInboxItem | KevInboxItem

export type InboxCounts = Record<InboxKind, number> & { total: number }
