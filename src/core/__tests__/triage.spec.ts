import { describe, expect, it } from 'vitest'

import { collectSuppressions } from '#core/suppressions.ts'
import { resolveTriage } from '#core/triage.ts'

import { buildBaseline, buildDecision, buildFinding, NOW } from './coreBuilders.ts'

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

describe('resolveTriage', () => {
  it('maps each finding to its governing decision', () => {
    const findings = [
      buildFinding({ id: 1, imageRef: NGINX }),
      buildFinding({ id: 2, imageRef: REDIS }),
      buildFinding({ id: 3, vulnId: 'CVE-2025-2' }),
    ]
    const all = buildDecision({ id: 10, scope: 'all', imageRef: null })
    const image = buildDecision({ id: 11, imageRef: NGINX, status: 'fix_planned' })
    const triage = resolveTriage(findings, [all, image], NOW)

    expect(triage.byFinding.get(1)?.decision.id).toBe(11)
    expect(triage.byFinding.get(1)?.effective.state).toBe('fix_planned')
    expect(triage.byFinding.get(2)?.decision.id).toBe(10)
    expect(triage.byFinding.has(3)).toBe(false)
    expect(triage.byDecision.get(10)?.openFindings.map((finding) => finding.id)).toEqual([2])
  })

  it('re-opens an all-scope decision for every image when one image rose', () => {
    const findings = [
      buildFinding({ id: 1, imageRef: NGINX, severity: 'High' }),
      buildFinding({ id: 2, imageRef: REDIS, severity: 'Critical' }),
    ]
    const all = buildDecision({
      id: 10,
      scope: 'all',
      imageRef: null,
      baselines: [buildBaseline({ imageRef: NGINX }), buildBaseline({ imageRef: REDIS })],
    })
    const triage = resolveTriage(findings, [all], NOW)

    expect(triage.byFinding.get(1)?.effective.state).toBe('reopened')
    expect(triage.byFinding.get(2)?.effective.state).toBe('reopened')
    expect(triage.byDecision.get(10)?.liveTrigger).toMatchObject({ imageRef: REDIS })
  })

  it('re-opens an all-scope decision when a low image rises next to an own-decided critical one', () => {
    const own = buildDecision({ id: 11, imageRef: NGINX, severityAtDecision: 'Critical' })
    const all = buildDecision({
      id: 10,
      scope: 'all',
      imageRef: null,
      severityAtDecision: 'Low',
      baselines: [buildBaseline({ imageRef: REDIS, severity: 'Low' })],
    })
    const before = [
      buildFinding({ id: 1, imageRef: NGINX, severity: 'Critical' }),
      buildFinding({ id: 2, imageRef: REDIS, severity: 'Low' }),
    ]
    const after = [before[0]!, buildFinding({ id: 2, imageRef: REDIS, severity: 'High' })]

    expect(collectSuppressions(before, resolveTriage(before, [all, own], NOW))).toHaveLength(2)

    const triage = resolveTriage(after, [all, own], NOW)

    expect(triage.byDecision.get(10)?.effective).toMatchObject({
      state: 'reopened',
      reason: 'severity_rose',
      imageRef: REDIS,
      baselineSeverity: 'Low',
    })
    expect(triage.byDecision.get(11)?.effective.state).toBe('active')
    expect(collectSuppressions(after, triage)).toEqual([
      { vulnId: 'CVE-2025-1000', imageRef: NGINX },
    ])
  })

  it('re-opens an all-scope decision when the lower of two governed images rises', () => {
    const all = buildDecision({
      id: 10,
      scope: 'all',
      imageRef: null,
      severityAtDecision: 'Critical',
      baselines: [
        buildBaseline({ imageRef: NGINX, severity: 'Critical' }),
        buildBaseline({ imageRef: REDIS, severity: 'Low' }),
      ],
    })
    const findings = [
      buildFinding({ id: 1, imageRef: NGINX, severity: 'Critical' }),
      buildFinding({ id: 2, imageRef: REDIS, severity: 'High' }),
    ]
    const triage = resolveTriage(findings, [all], NOW)

    expect(triage.byDecision.get(10)?.effective.state).toBe('reopened')
    expect(collectSuppressions(findings, triage)).toEqual([])
  })

  it('ignores resolved findings for the re-open check', () => {
    const findings = [buildFinding({ id: 1, severity: 'Critical', resolvedAt: NOW.toISOString() })]
    const triage = resolveTriage(findings, [buildDecision({ id: 10 })], NOW)

    expect(triage.byDecision.get(10)?.effective.state).toBe('active')
    expect(triage.byDecision.get(10)?.openFindings).toEqual([])
    expect(triage.byFinding.get(1)?.decision.id).toBe(10)
  })

  it('evaluates revoked decisions without letting them govern', () => {
    const revoked = buildDecision({ id: 10, revokedAt: '2026-05-02T00:00:00.000Z' })
    const triage = resolveTriage([buildFinding({ id: 1 })], [revoked], NOW)

    expect(triage.byDecision.get(10)?.effective.state).toBe('revoked')
    expect(triage.byFinding.has(1)).toBe(false)
  })
})
