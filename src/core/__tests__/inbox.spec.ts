import { describe, expect, it } from 'vitest'

import { compareInbox, isInInbox } from '#core/inbox.ts'

import { buildFinding, NOW } from './coreBuilders.ts'

describe('isInInbox', () => {
  const open = buildFinding()

  it('contains open findings without a decision or with a lapsed one', () => {
    expect(isInInbox(open, null)).toBe(true)
    expect(isInInbox(open, { state: 'expired', expiresAt: NOW.toISOString() })).toBe(true)
    expect(isInInbox(open, { state: 'revoked', revokedAt: NOW.toISOString() })).toBe(true)
    expect(
      isInInbox(open, {
        state: 'reopened',
        reopenedAt: null,
        reason: 'kev_listed',
        imageRef: open.imageRef,
        severity: 'High',
        kev: true,
        baselineSeverity: 'High',
        baselineKev: false,
      }),
    ).toBe(true)
  })

  it('leaves out decided and resolved findings', () => {
    expect(isInInbox(open, { state: 'active' })).toBe(false)
    expect(isInInbox(open, { state: 'fix_planned' })).toBe(false)
    expect(isInInbox(buildFinding({ resolvedAt: NOW.toISOString() }), null)).toBe(false)
  })
})

describe('compareInbox', () => {
  it('sorts KEV, exposure, severity, score, vuln_id', () => {
    const findings = [
      buildFinding({ vulnId: 'CVE-9', severity: 'Low', score: 2 }),
      buildFinding({ vulnId: 'CVE-8', severity: 'Critical', score: 9.1 }),
      buildFinding({ vulnId: 'CVE-7', severity: 'Critical', score: 9.8 }),
      buildFinding({ vulnId: 'CVE-6', severity: 'Critical', score: null }),
      buildFinding({ vulnId: 'CVE-5', severity: 'Low', exposure: 'gated' }),
      buildFinding({ vulnId: 'CVE-4', severity: 'Low', exposure: 'public' }),
      buildFinding({ vulnId: 'CVE-3', severity: 'Low', kev: true }),
      buildFinding({ vulnId: 'CVE-2', severity: 'Low', score: 2 }),
    ]

    expect([...findings].sort(compareInbox).map((finding) => finding.vulnId)).toEqual([
      'CVE-3',
      'CVE-4',
      'CVE-5',
      'CVE-7',
      'CVE-8',
      'CVE-6',
      'CVE-2',
      'CVE-9',
    ])
  })

  it('ranks unknown exposure after gated and before internal', () => {
    const findings = [
      buildFinding({ vulnId: 'CVE-4', exposure: 'internal', severity: 'Critical' }),
      buildFinding({ vulnId: 'CVE-3', exposure: null, severity: 'Low' }),
      buildFinding({ vulnId: 'CVE-2', exposure: 'gated', severity: 'Low' }),
      buildFinding({ vulnId: 'CVE-1', exposure: 'public', severity: 'Low' }),
    ]

    expect([...findings].sort(compareInbox).map((finding) => finding.vulnId)).toEqual([
      'CVE-1',
      'CVE-2',
      'CVE-3',
      'CVE-4',
    ])
  })

  it('sorts KEV, severity, score when no finding has an exposure', () => {
    const findings = [
      buildFinding({ vulnId: 'CVE-3', exposure: null, severity: 'Critical', score: 9.1 }),
      buildFinding({ vulnId: 'CVE-2', exposure: null, severity: 'Critical', score: 9.8 }),
      buildFinding({ vulnId: 'CVE-1', exposure: null, severity: 'Low', kev: true }),
      buildFinding({ vulnId: 'CVE-4', exposure: null, severity: 'High' }),
    ]

    expect([...findings].sort(compareInbox).map((finding) => finding.vulnId)).toEqual([
      'CVE-1',
      'CVE-2',
      'CVE-3',
      'CVE-4',
    ])
  })
})
