import { describe, expect, it } from 'vitest'

import { evaluateDecision, isSuppressing, leavesInbox } from '#core/effectiveDecision.ts'
import type { ReopenTrigger } from '#core/reopenTrigger.ts'

import { buildBaseline, buildDecision, NOW } from './coreBuilders.ts'

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'
const SAME = [{ imageRef: NGINX, severity: 'High', kev: false }] as const

const TRIGGER: ReopenTrigger = {
  reason: 'severity_rose',
  imageRef: NGINX,
  severity: 'Critical',
  kev: false,
  baselineSeverity: 'High',
  baselineKev: false,
}

describe('evaluateDecision', () => {
  it('is active for not_affected and accepted decisions', () => {
    expect(evaluateDecision(buildDecision(), SAME, NOW)).toEqual({ state: 'active' })
    expect(evaluateDecision(buildDecision({ status: 'accepted' }), SAME, NOW).state).toBe('active')
  })

  it('reports fix_planned separately, it leaves the inbox without suppressing', () => {
    const effective = evaluateDecision(buildDecision({ status: 'fix_planned' }), SAME, NOW)

    expect(effective).toEqual({ state: 'fix_planned' })
    expect(isSuppressing(effective)).toBe(false)
    expect(leavesInbox(effective)).toBe(true)
  })

  it('expires at expires_at', () => {
    const decision = buildDecision({ expiresAt: NOW.toISOString() })

    expect(evaluateDecision(decision, SAME, NOW)).toEqual({
      state: 'expired',
      expiresAt: NOW.toISOString(),
    })
    expect(evaluateDecision(decision, SAME, new Date(NOW.getTime() - 1)).state).toBe('active')
  })

  it('lets revocation win over expiry and re-opening', () => {
    const decision = buildDecision({
      revokedAt: '2026-05-20T00:00:00.000Z',
      expiresAt: '2026-05-21T00:00:00.000Z',
      reopenedAt: '2026-05-19T00:00:00.000Z',
      reopenTrigger: TRIGGER,
    })

    expect(
      evaluateDecision(decision, [{ imageRef: NGINX, severity: 'Critical', kev: true }], NOW),
    ).toEqual({ state: 'revoked', revokedAt: '2026-05-20T00:00:00.000Z' })
  })

  it('re-opens live when a finding rose above its baseline', () => {
    const effective = evaluateDecision(
      buildDecision(),
      [{ imageRef: NGINX, severity: 'Critical', kev: false }],
      NOW,
    )

    expect(effective).toEqual({ state: 'reopened', reopenedAt: null, ...TRIGGER })
    expect(leavesInbox(effective)).toBe(false)
  })

  it('stays active when the severity fell', () => {
    expect(
      evaluateDecision(buildDecision(), [{ imageRef: NGINX, severity: 'Low', kev: false }], NOW)
        .state,
    ).toBe('active')
  })

  it('re-opens when the CVE became KEV listed, not when it already was', () => {
    const kevNow = [{ imageRef: NGINX, severity: 'High', kev: true }] as const

    expect(evaluateDecision(buildDecision(), kevNow, NOW)).toMatchObject({
      state: 'reopened',
      reason: 'kev_listed',
      baselineKev: false,
    })
    expect(evaluateDecision(buildDecision({ kevAtDecision: true }), kevNow, NOW).state).toBe(
      'active',
    )
  })

  it('compares every governed image with its own baseline', () => {
    const decision = buildDecision({
      scope: 'all',
      imageRef: null,
      severityAtDecision: 'Critical',
      baselines: [
        buildBaseline({ imageRef: NGINX, severity: 'Critical' }),
        buildBaseline({ imageRef: REDIS, severity: 'Low' }),
      ],
    })
    const nginxCritical = { imageRef: NGINX, severity: 'Critical', kev: false } as const

    expect(
      evaluateDecision(
        decision,
        [nginxCritical, { imageRef: REDIS, severity: 'Low', kev: false }],
        NOW,
      ).state,
    ).toBe('active')
    expect(
      evaluateDecision(
        decision,
        [nginxCritical, { imageRef: REDIS, severity: 'High', kev: false }],
        NOW,
      ),
    ).toMatchObject({
      state: 'reopened',
      imageRef: REDIS,
      severity: 'High',
      baselineSeverity: 'Low',
    })
  })

  it('covers a governed image without a baseline at its current state', () => {
    expect(
      evaluateDecision(buildDecision(), [{ imageRef: REDIS, severity: 'Critical', kev: true }], NOW)
        .state,
    ).toBe('active')
  })

  it('stays re-opened once latched, even when the findings fell back', () => {
    const decision = buildDecision({
      reopenedAt: '2026-05-30T00:00:00.000Z',
      reopenTrigger: TRIGGER,
    })

    expect(evaluateDecision(decision, SAME, NOW)).toEqual({
      state: 'reopened',
      reopenedAt: '2026-05-30T00:00:00.000Z',
      ...TRIGGER,
    })
    expect(evaluateDecision(decision, [], NOW).state).toBe('reopened')
  })

  it('lets expiry win over a latched re-open', () => {
    const decision = buildDecision({
      expiresAt: '2026-05-31T00:00:00.000Z',
      reopenedAt: '2026-05-30T00:00:00.000Z',
      reopenTrigger: TRIGGER,
    })

    expect(evaluateDecision(decision, SAME, NOW).state).toBe('expired')
  })

  it('re-opens fix_planned decisions too', () => {
    const decision = buildDecision({ status: 'fix_planned' })

    expect(
      evaluateDecision(decision, [{ imageRef: NGINX, severity: 'Critical', kev: false }], NOW)
        .state,
    ).toBe('reopened')
  })

  it('skips the live re-open check without open findings', () => {
    expect(evaluateDecision(buildDecision(), [], NOW).state).toBe('active')
  })
})
