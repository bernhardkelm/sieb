// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { NOW } from '#core/__tests__/coreBuilders.ts'
import { renderMetrics } from '#core/metricsText.ts'
import { createDecision } from '#server/db/createDecision.ts'
import { finishSyncRun, startSyncRun } from '#server/db/syncRunRepository.ts'
import { readMetricsInput } from '#server/metrics/readMetricsInput.ts'

import { NGINX, seededDatabase } from '#server/db/__tests__/dbFixtures.ts'

describe('readMetricsInput', () => {
  it('exposes suppressing decisions, the last finished sync and open findings', () => {
    const db = seededDatabase(NOW)
    const run = startSyncRun(db, 'mock', NOW)
    const counts = {
      findingsSeen: 3,
      findingsNew: 3,
      findingsResolved: 0,
      findingsReappeared: 0,
      instancesSeen: 4,
      instancesNew: 4,
      instancesResolved: 0,
      decisionEvents: 0,
    }

    finishSyncRun(db, run.id, { fetchedAt: NOW.toISOString(), counts }, NOW)
    createDecision(
      db,
      {
        vulnId: 'CVE-2025-1000',
        scope: 'image',
        imageRef: NGINX,
        status: 'accepted',
        justification: null,
        reason: 'x',
        expiresAt: null,
      },
      'dev',
      NOW,
    )
    createDecision(
      db,
      {
        vulnId: 'CVE-2025-2000',
        scope: 'all',
        imageRef: null,
        status: 'fix_planned',
        justification: null,
        reason: 'y',
        expiresAt: null,
      },
      'dev',
      NOW,
    )

    const input = readMetricsInput(db, NOW)

    expect(input).toEqual({
      suppressions: [{ vulnId: 'CVE-2025-1000', imageRef: NGINX }],
      lastSync: { finishedAt: NOW.toISOString(), ok: true },
      findingsOpen: 3,
      decisionStates: { active: 1, fix_planned: 1, expired: 0, reopened: 0, revoked: 0 },
    })
    expect(renderMetrics(input)).toContain(
      `sieb_suppressed{vuln_id="CVE-2025-1000",image_ref="${NGINX}"} 1`,
    )
  })
})
