import { describe, expect, it } from 'vitest'

import { countDecisionStates } from '#core/decisionStates.ts'
import { escapeLabelValue, renderMetrics } from '#core/metricsText.ts'
import { collectSuppressions } from '#core/suppressions.ts'
import { resolveTriage } from '#core/triage.ts'

import { buildDecision, buildFinding, NOW } from './coreBuilders.ts'

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'
const POSTGRES = 'index.docker.io/library/postgres'
const GRAFANA = 'index.docker.io/grafana/grafana'
const NO_DECISIONS = { active: 0, fix_planned: 0, expired: 0, reopened: 0, revoked: 0 }

describe('escapeLabelValue', () => {
  it('escapes backslash, double quote and newline', () => {
    expect(escapeLabelValue('a\\b"c\nd')).toBe('a\\\\b\\"c\\nd')
  })
})

describe('collectSuppressions', () => {
  const findings = [
    buildFinding({ id: 1, imageRef: NGINX }),
    buildFinding({ id: 2, imageRef: REDIS }),
    buildFinding({ id: 3, imageRef: POSTGRES }),
    buildFinding({ id: 4, imageRef: GRAFANA, resolvedAt: NOW.toISOString() }),
    buildFinding({ id: 5, vulnId: 'CVE-2025-2000', imageRef: NGINX }),
  ]

  it('expands an all-scope decision over the open findings it governs', () => {
    const decisions = [
      buildDecision({ id: 10, scope: 'all', imageRef: null }),
      buildDecision({ id: 11, imageRef: POSTGRES, status: 'fix_planned' }),
      buildDecision({ id: 12, vulnId: 'CVE-2025-2000', imageRef: NGINX }),
    ]

    expect(collectSuppressions(findings, resolveTriage(findings, decisions, NOW))).toEqual([
      { vulnId: 'CVE-2025-1000', imageRef: NGINX },
      { vulnId: 'CVE-2025-1000', imageRef: REDIS },
      { vulnId: 'CVE-2025-2000', imageRef: NGINX },
    ])
  })

  it('leaves an image unsilenced whose own decision re-opened under an all-scope decision', () => {
    const rising = [...findings.slice(0, 2), buildFinding({ id: 3, imageRef: POSTGRES, kev: true })]
    const decisions = [
      buildDecision({ id: 10, scope: 'all', imageRef: null, kevAtDecision: true }),
      buildDecision({ id: 11, imageRef: POSTGRES, kevAtDecision: false }),
    ]
    const triage = resolveTriage(rising, decisions, NOW)

    expect(triage.byFinding.get(3)?.effective.state).toBe('reopened')
    expect(collectSuppressions(rising, triage)).toEqual([
      { vulnId: 'CVE-2025-1000', imageRef: NGINX },
      { vulnId: 'CVE-2025-1000', imageRef: REDIS },
    ])
  })

  it('deduplicates series and skips expired and revoked decisions', () => {
    const twice = [...findings.slice(0, 1), buildFinding({ id: 6, imageRef: NGINX })]
    const decisions = [
      buildDecision({ id: 10, imageRef: NGINX }),
      buildDecision({ id: 11, imageRef: REDIS, expiresAt: '2026-05-01T00:00:00.000Z' }),
      buildDecision({ id: 12, scope: 'all', imageRef: null, revokedAt: NOW.toISOString() }),
    ]
    const subjects = [...twice, ...findings.slice(1, 3)]

    expect(collectSuppressions(subjects, resolveTriage(subjects, decisions, NOW))).toEqual([
      { vulnId: 'CVE-2025-1000', imageRef: NGINX },
    ])
  })
})

describe('countDecisionStates', () => {
  it('counts every state, absent ones as zero', () => {
    expect(
      countDecisionStates([
        { effective: { state: 'active' } },
        { effective: { state: 'active' } },
        { effective: { state: 'revoked', revokedAt: NOW.toISOString() } },
      ]),
    ).toEqual({ active: 2, fix_planned: 0, expired: 0, reopened: 0, revoked: 1 })
  })
})

describe('renderMetrics', () => {
  it('renders all series with HELP and TYPE lines and escaped labels', () => {
    const text = renderMetrics({
      suppressions: [{ vulnId: 'CVE-1', imageRef: 'reg/"odd"\\name' }],
      lastSync: { finishedAt: '2026-06-01T12:00:00.000Z', ok: true },
      findingsOpen: 42,
      decisionStates: { ...NO_DECISIONS, active: 3 },
    })

    expect(text).toContain('# TYPE sieb_suppressed gauge\n')
    expect(text).toContain('sieb_suppressed{vuln_id="CVE-1",image_ref="reg/\\"odd\\"\\\\name"} 1\n')
    expect(text).not.toContain('sieb_suppressed_all')
    expect(text).toContain('sieb_last_sync_timestamp_seconds 1780315200\n')
    expect(text).toContain('sieb_last_sync_success 1\n')
    expect(text).toContain('sieb_findings_open 42\n')
    expect(text).toContain('sieb_decisions{state="active"} 3\n')
    expect(text).toContain('sieb_decisions{state="revoked"} 0\n')
    expect(text.match(/^# HELP /gm)).toHaveLength(5)
    expect(text.endsWith('\n')).toBe(true)
  })

  it('omits the sync timestamp before the first finished sync', () => {
    const text = renderMetrics({
      suppressions: [],
      lastSync: null,
      findingsOpen: 0,
      decisionStates: NO_DECISIONS,
    })

    expect(text).not.toMatch(/^sieb_last_sync_timestamp_seconds /m)
    expect(text).toContain('sieb_last_sync_success 0\n')
  })
})
