import { describe, expect, it } from 'vitest'

import {
  buildBaseline,
  buildDecision,
  buildFindingView,
  NOW,
} from '#core/__tests__/coreBuilders.ts'
import { filterFindings } from '#core/findingFilter.ts'
import {
  buildPendingIndex,
  matchesPending,
  pendingStatesOf,
  type PendingIndex,
  type PendingTarget,
} from '#core/findingPending.ts'
import { parseFindingQuery, type FindingQuery } from '#core/findingQuery.ts'
import type { InboxFinding } from '#core/inbox/inboxItem.ts'
import {
  fromNow,
  inboxFinding,
  inboxOf,
  inboxProposal,
  NGINX,
  REDIS,
} from '#core/inbox/__tests__/inboxBuilders.ts'
import { resolveTriage } from '#core/triage.ts'
import { DAY_MS } from '#core/timeUnits.ts'

const POSTGRES = 'index.docker.io/library/postgres'

const FINDINGS: InboxFinding[] = [
  inboxFinding({ id: 1, vulnId: 'CVE-A', imageRef: NGINX }),
  inboxFinding({ id: 2, vulnId: 'CVE-A', imageRef: REDIS }),
  inboxFinding({ id: 3, vulnId: 'CVE-A', imageRef: POSTGRES }),
  inboxFinding({ id: 4, vulnId: 'CVE-B', imageRef: NGINX }),
  inboxFinding({ id: 5, vulnId: 'CVE-B', imageRef: REDIS }),
  inboxFinding({ id: 6, vulnId: 'CVE-C', severity: 'Critical' }),
  inboxFinding({ id: 7, vulnId: 'CVE-D', imageRef: NGINX, severity: 'Critical' }),
  inboxFinding({ id: 8, vulnId: 'CVE-D', imageRef: REDIS, severity: 'Critical' }),
  inboxFinding({ id: 9, vulnId: 'CVE-E', kev: true, kevSince: fromNow(-DAY_MS) }),
  inboxFinding({ id: 10, vulnId: 'CVE-F', kev: true, kevSince: fromNow(-DAY_MS) }),
  inboxFinding({ id: 11, vulnId: 'CVE-G' }),
  inboxFinding({ id: 12, vulnId: 'CVE-H' }),
]

const DECISIONS = [
  buildDecision({ id: 20, vulnId: 'CVE-C' }),
  buildDecision({
    id: 21,
    vulnId: 'CVE-D',
    scope: 'all',
    imageRef: null,
    baselines: [buildBaseline({ imageRef: NGINX }), buildBaseline({ imageRef: REDIS })],
  }),
  buildDecision({ id: 22, vulnId: 'CVE-G', status: 'accepted', expiresAt: fromNow(DAY_MS) }),
]

const PROPOSALS = [
  inboxProposal({ id: 30, vulnId: 'CVE-A', imageRefs: [NGINX] }),
  inboxProposal({ id: 31, vulnId: 'CVE-A', imageRefs: [REDIS, 'index.docker.io/library/gone'] }),
  inboxProposal({ id: 32, vulnId: 'CVE-B', imageRefs: null }),
]

/**
 * Builds the pending index of the fixture Inbox, finding 12 with an open check.
 * @param {ReadonlyMap<string, string>} seen - Seen marks of the user
 * @param {boolean} checksEnabled - Whether Auto-check is on
 * @returns {PendingIndex} - Index
 */
const indexOf = (
  seen: ReadonlyMap<string, string> = new Map(),
  checksEnabled = true,
): PendingIndex =>
  buildPendingIndex(
    inboxOf({ findings: FINDINGS, decisions: DECISIONS, proposals: PROPOSALS, seen }).items,
    checksEnabled ? [12] : null,
  )

const triage = resolveTriage(FINDINGS, DECISIONS, NOW)

/**
 * Returns a fixture finding with its governing decision.
 * @param {number} id - Finding id
 * @returns {PendingTarget} - Target
 */
const target = (id: number): PendingTarget => {
  const finding = FINDINGS.find((candidate) => candidate.id === id)!

  return { ...finding, decision: triage.byFinding.get(id)?.decision ?? null }
}

/**
 * Lists the fixture findings a pending filter keeps.
 * @param {Parameters<typeof matchesPending>[1]} selected - Selected options
 * @param {PendingIndex} index - Index
 * @returns {number[]} - Finding ids
 */
const kept = (selected: Parameters<typeof matchesPending>[1], index = indexOf()): number[] =>
  FINDINGS.filter((finding) => matchesPending(target(finding.id), selected, index)).map(
    (finding) => finding.id,
  )

describe('pendingStatesOf', () => {
  it('marks findings an open proposal targets, on its image, several images or every image', () => {
    expect(kept(['proposed'])).toEqual([1, 2, 4, 5])
  })

  it('marks findings whose governing decision is re-opened, also a decision on every image', () => {
    expect(kept(['reopened'])).toEqual([6, 7, 8])
  })

  it('marks new KEV listings unless the user marked them as seen', () => {
    expect(kept(['kev'])).toEqual([9, 10])
    expect(kept(['kev'], indexOf(new Map([['kev:9', NOW.toISOString()]])))).toEqual([10])
  })

  it('marks findings with an open check and ignores checking while Auto-check is off', () => {
    expect(kept(['checking'])).toEqual([12])
    expect(kept(['checking'], indexOf(new Map(), false))).toHaveLength(FINDINGS.length)
  })

  it('keeps untouched findings, an expiring decision does not count as pending', () => {
    expect(kept(['untouched'])).toEqual([3, 11])
    expect(kept(['untouched'], indexOf(new Map(), false))).toEqual([3, 11, 12])
  })

  it('combines several options with OR and matches everything without a selection', () => {
    expect(kept(['kev', 'untouched'])).toEqual([3, 9, 10, 11])
    expect(kept([])).toHaveLength(FINDINGS.length)
  })

  it('gives resolved findings no pending state', () => {
    const resolved = { ...target(1), resolvedAt: NOW.toISOString() }

    expect([...pendingStatesOf(target(1), indexOf())]).toEqual(['proposed'])
    expect(pendingStatesOf(resolved, indexOf()).size).toBe(0)
  })
})

describe('filterFindings with pending', () => {
  const views = [
    buildFindingView({ id: 1, vulnId: 'CVE-A', imageRef: NGINX }),
    buildFindingView({ id: 3, vulnId: 'CVE-A', imageRef: POSTGRES }),
  ]
  /**
   * Parses a valid finding query.
   * @param {Record<string, string>} raw - Query parameters
   * @returns {FindingQuery} - Parsed query
   */
  const query = (raw: Record<string, string>): FindingQuery => {
    const parsed = parseFindingQuery(raw)

    if (!parsed.ok) {
      throw new Error('invalid query')
    }

    return parsed.value
  }

  it('applies the pending filter with an index and ignores it without one', () => {
    const pending = indexOf()

    expect(
      filterFindings(views, query({ pending: 'proposed' }), { kevDatesAdded: null, pending }),
    ).toHaveLength(1)
    expect(
      filterFindings(views, query({ pending: 'untouched' }), { kevDatesAdded: null, pending }),
    ).toMatchObject([{ id: 3 }])
    expect(filterFindings(views, query({ pending: 'proposed' }))).toHaveLength(2)
  })

  it('rejects unknown options', () => {
    expect(parseFindingQuery({ pending: 'proposed,later' })).toEqual({
      ok: false,
      errors: [{ field: 'pending', code: 'invalid' }],
    })
  })
})
