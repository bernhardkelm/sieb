import { describe, expect, it } from 'vitest'

import { buildBaseline, buildDecision, NOW } from '#core/__tests__/coreBuilders.ts'

import {
  DAY_MS,
  fromNow,
  inboxFinding,
  inboxOf,
  inboxProposal,
  NGINX,
  REDIS,
} from './inboxBuilders.ts'

const WINDOW_MS = 14 * DAY_MS

describe('buildInbox proposals', () => {
  it('lists open proposals with the facts of the open findings they target', () => {
    const findings = [
      inboxFinding({ id: 1, imageRef: NGINX, severity: 'Medium', title: 'libssl overflow' }),
      inboxFinding({ id: 2, imageRef: REDIS, severity: 'Critical', kev: true }),
      inboxFinding({ id: 3, imageRef: REDIS, vulnId: 'CVE-2025-2000', severity: 'Critical' }),
    ]
    const { items, counts } = inboxOf({
      findings,
      proposals: [
        inboxProposal({ id: 7, imageRefs: [NGINX], createdAt: fromNow(-DAY_MS) }),
        inboxProposal({
          id: 8,
          imageRefs: null,
          createdAt: fromNow(-2 * DAY_MS),
          verdict: 'needs_patch',
          patchAction: 'upgrade libssl3 to 3.0.2',
        }),
      ],
    })

    expect(items).toEqual([
      {
        kind: 'proposal',
        key: 'proposal:7',
        at: fromNow(-DAY_MS),
        vulnId: 'CVE-2025-1000',
        imageRef: NGINX,
        severity: 'Medium',
        kev: false,
        title: 'libssl overflow',
        url: 'https://sieb.example.com/inbox/proposals/7',
        refs: { proposalId: 7 },
        imageRefs: [NGINX],
        verdict: 'not_affected',
        confidence: 'high',
        patchAction: null,
        imageCount: 1,
      },
      expect.objectContaining({
        key: 'proposal:8',
        imageRef: null,
        imageRefs: null,
        severity: 'Critical',
        kev: true,
        title: 'libssl overflow',
        patchAction: 'upgrade libssl3 to 3.0.2',
        imageCount: 2,
      }),
    ])
    expect(counts).toEqual({ proposal: 2, reopened: 0, expiring: 0, kev: 0, total: 2 })
  })

  it('keeps a proposal whose findings resolved meanwhile with neutral facts', () => {
    const { items } = inboxOf({
      findings: [inboxFinding({ resolvedAt: fromNow(-1) })],
      proposals: [inboxProposal({ imageRefs: [NGINX, REDIS] })],
    })

    expect(items[0]).toMatchObject({ imageRef: null, severity: 'Unknown', imageCount: 0 })
  })
})

describe('buildInbox decisions', () => {
  it('lists a latched re-open with its trigger image as lead finding', () => {
    const trigger = {
      reason: 'kev_listed' as const,
      imageRef: REDIS,
      severity: 'High' as const,
      kev: true,
      baselineSeverity: 'High' as const,
      baselineKev: false,
    }
    const { items } = inboxOf({
      findings: [
        inboxFinding({ id: 1, imageRef: NGINX, severity: 'Critical' }),
        inboxFinding({ id: 2, imageRef: REDIS }),
      ],
      decisions: [
        buildDecision({
          id: 4,
          scope: 'all',
          imageRef: null,
          status: 'accepted',
          reopenedAt: fromNow(-3 * DAY_MS),
          reopenTrigger: trigger,
          baselines: [buildBaseline({ imageRef: NGINX }), buildBaseline({ imageRef: REDIS })],
        }),
      ],
    })

    expect(items).toEqual([
      {
        kind: 'reopened',
        key: `reopened:4:${fromNow(-3 * DAY_MS)}`,
        at: fromNow(-3 * DAY_MS),
        vulnId: 'CVE-2025-1000',
        imageRef: null,
        severity: 'Critical',
        kev: false,
        title: null,
        url: 'https://sieb.example.com/triage?finding=2',
        refs: { decisionId: 4, findingId: 2 },
        decisionStatus: 'accepted',
        reopenReason: 'kev_listed',
      },
    ])
  })

  it('lists a re-open no sync latched yet under a pending key at the current time', () => {
    const { items } = inboxOf({
      findings: [inboxFinding({ severity: 'Critical' })],
      decisions: [buildDecision({ id: 5 })],
    })

    expect(items).toMatchObject([
      { key: 'reopened:5:pending', at: NOW.toISOString(), reopenReason: 'severity_rose' },
    ])
  })

  it('lists active decisions expiring within 14 days, boundary included', () => {
    const decisions = [
      buildDecision({ id: 1, status: 'accepted', expiresAt: fromNow(WINDOW_MS) }),
      buildDecision({
        id: 2,
        status: 'accepted',
        expiresAt: fromNow(WINDOW_MS + 1),
        vulnId: 'CVE-5',
      }),
      buildDecision({ id: 3, status: 'accepted', expiresAt: fromNow(-1), imageRef: REDIS }),
      buildDecision({ id: 4, status: 'fix_planned', expiresAt: fromNow(DAY_MS), vulnId: 'CVE-2' }),
      buildDecision({ id: 5, expiresAt: fromNow(DAY_MS), vulnId: 'CVE-3', revokedAt: fromNow(-1) }),
    ]
    const { items } = inboxOf({
      findings: [inboxFinding({ id: 9 }), inboxFinding({ id: 10, imageRef: REDIS })],
      decisions,
    })

    expect(items).toEqual([
      expect.objectContaining({
        kind: 'expiring',
        key: `expiring:1:${fromNow(WINDOW_MS)}`,
        at: fromNow(WINDOW_MS),
        refs: { decisionId: 1, findingId: 9 },
        url: 'https://sieb.example.com/triage?finding=9',
        decisionStatus: 'accepted',
      }),
    ])
  })

  it('links an expiring decision without open findings to the decisions view', () => {
    const { items } = inboxOf({
      decisions: [buildDecision({ id: 6, status: 'accepted', expiresAt: fromNow(DAY_MS) })],
    })

    expect(items).toMatchObject([
      {
        url: 'https://sieb.example.com/decisions?state=active&decision=6',
        refs: { decisionId: 6, findingId: null },
        severity: 'High',
      },
    ])
  })
})

describe('buildInbox KEV listings', () => {
  it('lists open findings KEV listed within 14 days, also decided ones', () => {
    const findings = [
      inboxFinding({ id: 1, kev: true, kevSince: fromNow(-WINDOW_MS) }),
      inboxFinding({ id: 2, kev: true, kevSince: fromNow(-WINDOW_MS - 1), imageRef: REDIS }),
      inboxFinding({ id: 3, kev: true, kevSince: fromNow(-DAY_MS), resolvedAt: fromNow(-1) }),
      inboxFinding({ id: 4, kev: true, kevSince: null, vulnId: 'CVE-2' }),
    ]
    const decision = buildDecision({ id: 8, kevAtDecision: true })
    const { items, counts } = inboxOf({ findings, decisions: [decision] })

    expect(items).toEqual([
      {
        kind: 'kev',
        key: 'kev:1',
        at: fromNow(-WINDOW_MS),
        vulnId: 'CVE-2025-1000',
        imageRef: NGINX,
        severity: 'High',
        kev: true,
        title: null,
        url: 'https://sieb.example.com/triage?finding=1',
        refs: { findingId: 1, decisionId: 8 },
        decisionStatus: 'not_affected',
      },
    ])
    expect(counts.kev).toBe(1)
  })
})

describe('buildInbox seen marks, order and counts', () => {
  const expiring = buildDecision({ id: 3, status: 'accepted', expiresAt: fromNow(DAY_MS) })
  const findings = [inboxFinding({ id: 1, kev: true, kevSince: fromNow(-DAY_MS) })]
  const decision = { ...expiring, kevAtDecision: true, baselines: [buildBaseline({ kev: true })] }
  const decisions = [decision]

  it('hides seen expiring and KEV items, a KEV mark only from the current listing on', () => {
    /**
     * Builds seen marks with a given KEV mark time.
     * @param {string} kevSeenAt - When kev:1 was marked
     * @returns {Map<string, string>} - Marks
     */
    const marks = (kevSeenAt: string): Map<string, string> =>
      new Map([
        [`expiring:3:${fromNow(DAY_MS)}`, fromNow(-1)],
        ['kev:1', kevSeenAt],
        ['proposal:2', fromNow(-1)],
      ])
    const proposals = [inboxProposal({ id: 2 })]

    expect(
      inboxOf({ findings, decisions, proposals, seen: marks(fromNow(-1)) }).items.map(
        (item) => item.key,
      ),
    ).toEqual(['proposal:2'])
    expect(
      inboxOf({ findings, decisions, proposals, seen: marks(fromNow(-2 * DAY_MS)) }).items.map(
        (item) => item.key,
      ),
    ).toEqual(['kev:1', 'proposal:2'])
  })

  it('shows an extended decision again under its new key', () => {
    const seen = new Map([[`expiring:3:${fromNow(DAY_MS)}`, fromNow(-1)]])
    const extended = [{ ...decision, expiresAt: fromNow(2 * DAY_MS) }]

    expect(inboxOf({ decisions: extended, seen }).items.map((item) => item.key)).toEqual([
      `expiring:3:${fromNow(2 * DAY_MS)}`,
    ])
  })

  it('sorts events newest first, then expiring decisions soonest first', () => {
    const { items, counts } = inboxOf({
      findings: [
        inboxFinding({ id: 1, kev: true, kevSince: fromNow(-2 * DAY_MS) }),
        inboxFinding({ id: 2, vulnId: 'CVE-2', kev: true, kevSince: fromNow(-2 * DAY_MS) }),
        inboxFinding({ id: 3, vulnId: 'CVE-3' }),
        inboxFinding({ id: 4, vulnId: 'CVE-4' }),
      ],
      decisions: [
        buildDecision({
          id: 1,
          vulnId: 'CVE-3',
          status: 'accepted',
          expiresAt: fromNow(5 * DAY_MS),
        }),
        buildDecision({ id: 2, vulnId: 'CVE-4', status: 'accepted', expiresAt: fromNow(DAY_MS) }),
      ],
      proposals: [
        inboxProposal({ id: 1, createdAt: fromNow(-3 * DAY_MS) }),
        inboxProposal({ id: 2, createdAt: fromNow(-1) }),
      ],
    })

    expect(items.map((item) => item.key)).toEqual([
      'proposal:2',
      'kev:1',
      'kev:2',
      'proposal:1',
      `expiring:2:${fromNow(DAY_MS)}`,
      `expiring:1:${fromNow(5 * DAY_MS)}`,
    ])
    expect(counts).toEqual({ proposal: 2, reopened: 0, expiring: 2, kev: 2, total: 6 })
  })
})
