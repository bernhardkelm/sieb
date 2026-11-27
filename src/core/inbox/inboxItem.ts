import type { DecisionStatus } from '#core/decision.ts'
import type { ReopenReason } from '#core/effectiveDecision.ts'
import type { Exposure } from '#core/exposure.ts'
import type { Finding } from '#core/finding.ts'
import type { ProposalConfidence, ProposalVerdict } from '#core/proposal.ts'
import type { ExpectedDecisionId } from '#core/proposalFreshness.ts'
import type { ProposalClientKind } from '#core/proposalClient.ts'
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
  patchAction: string | null // only for needs_patch and fix_planned
  upstreamPending: boolean // fix_planned whose fix waits for an upstream release
  clientKind: ProposalClientKind | null
  clientLabel: string
  agent: string | null
  currentDecisionIds: ExpectedDecisionId[] // governing decision per target now
  outdated: boolean // a governing decision changed since the proposal was filed
}

/** Open finding as the Inbox needs it */
export type InboxFinding = Pick<
  Finding,
  'id' | 'vulnId' | 'imageRef' | 'severity' | 'kev' | 'title' | 'resolvedAt' | 'exposure' | 'owner'
> & {
  kevSince: string | null
  packages: string[] // packages of the open instances
  namespaces: string[] // namespaces of the open instances
}

/** Labels an item collects from the open findings it covers, what the Inbox filters read */
export interface InboxItemLabels {
  exposure: Exposure | null // most exposed covered finding, null when unknown or none is covered
  owners: string[] // distinct owner labels, sorted
  packages: string[] // distinct packages of the open instances, sorted
  namespaces: string[] // distinct namespaces of the open instances, sorted
}

/** Fields every Inbox row shows */
interface InboxItemBase extends InboxItemLabels {
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
  imageRefs: string[] | null // target images, null targets every affected image
  verdict: ProposalVerdict
  confidence: ProposalConfidence
  patchAction: string | null // only for needs_patch and fix_planned
  upstreamPending: boolean // fix_planned whose fix waits for an upstream release
  clientKind: ProposalClientKind | null // null when unknown, then clientLabel and agent describe it
  clientLabel: string // token name, OAuth client label or Auto-check #<id>
  agent: string | null // free label the client gave itself, untrusted
  imageCount: number // open findings the proposal covers
  currentDecisionIds: ExpectedDecisionId[] // governing decision per target, the expectedDecisionIds of an accept
  outdated: boolean // a governing decision changed since the proposal was filed
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
