import type { FindingView } from '#core/findingView.ts'
import { concernsFinding, type InboxFindingTarget } from '#core/inbox/findingInboxItems.ts'
import type { InboxItem, InboxKind } from '#core/inbox/inboxItem.ts'

/** What can wait on a finding: an open proposal, a re-opened decision, a new KEV listing, an open Auto-check */
export const PENDING_STATES = ['proposed', 'reopened', 'kev', 'checking'] as const

export type PendingState = (typeof PENDING_STATES)[number]

/** Options of the pending filter, untouched matches findings with no pending state */
export const PENDING_FILTERS = [...PENDING_STATES, 'untouched'] as const

export type PendingFilter = (typeof PENDING_FILTERS)[number]

/** Inbox items and open checks the pending filter reads */
export interface PendingIndex {
  byVuln: ReadonlyMap<string, readonly InboxItem[]> // Inbox items of the acting user per vuln_id
  checking: ReadonlySet<number> | null // finding ids with a queued or running check, null while Auto-check is off
}

export type PendingTarget = InboxFindingTarget & Pick<FindingView, 'resolvedAt'>

const STATE_OF_KIND: Partial<Record<InboxKind, PendingState>> = {
  proposal: 'proposed',
  reopened: 'reopened',
  kev: 'kev',
}

/**
 * Returns whether a value is a pending filter option.
 * @param {unknown} value - Value to test
 * @returns {boolean} - True for proposed, reopened, kev, checking and untouched
 */
export const isPendingFilter = (value: unknown): value is PendingFilter =>
  (PENDING_FILTERS as readonly unknown[]).includes(value)

/**
 * Indexes the Inbox items of a user by vuln_id together with the findings of the open checks.
 * @param {readonly InboxItem[]} items - Inbox items of the acting user
 * @param {Iterable<number> | null} checkingFindingIds - Findings of queued and running checks, null while Auto-check is off
 * @returns {PendingIndex} - Index for pendingStatesOf
 */
export const buildPendingIndex = (
  items: readonly InboxItem[],
  checkingFindingIds: Iterable<number> | null,
): PendingIndex => {
  const byVuln = new Map<string, InboxItem[]>()

  for (const item of items) {
    byVuln.set(item.vulnId, [...(byVuln.get(item.vulnId) ?? []), item])
  }

  return { byVuln, checking: checkingFindingIds === null ? null : new Set(checkingFindingIds) }
}

/**
 * Collects what waits on an open finding, with the rules of the Inbox markers: a proposal on its
 * image or on every image, a re-opened governing decision, its own new KEV listing, a queued or
 * running check. Resolved findings have none, the Inbox covers open findings only.
 * @param {PendingTarget} finding - Finding with its governing decision
 * @param {PendingIndex} index - Inbox items and open checks
 * @returns {Set<PendingState>} - Pending states, empty for an untouched finding
 */
export const pendingStatesOf = (finding: PendingTarget, index: PendingIndex): Set<PendingState> => {
  const states = new Set<PendingState>()

  if (finding.resolvedAt !== null) {
    return states
  }

  for (const item of index.byVuln.get(finding.vulnId) ?? []) {
    const state = STATE_OF_KIND[item.kind]

    if (state !== undefined && concernsFinding(item, finding)) {
      states.add(state)
    }
  }

  if (index.checking?.has(finding.id)) {
    states.add('checking')
  }

  return states
}

/**
 * Returns whether a finding passes the pending filter, several options match any of them.
 * checking is ignored while Auto-check is off, a filter left empty matches everything.
 * @param {PendingTarget} finding - Finding with its governing decision
 * @param {readonly PendingFilter[]} selected - Selected options
 * @param {PendingIndex} index - Inbox items and open checks
 * @returns {boolean} - True on a match
 */
export const matchesPending = (
  finding: PendingTarget,
  selected: readonly PendingFilter[],
  index: PendingIndex,
): boolean => {
  const applied = index.checking === null ? selected.filter((s) => s !== 'checking') : selected

  if (applied.length === 0) {
    return true
  }

  const states = pendingStatesOf(finding, index)

  return applied.some((option) => (option === 'untouched' ? states.size === 0 : states.has(option)))
}
