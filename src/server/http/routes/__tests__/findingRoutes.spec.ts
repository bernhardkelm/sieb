// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { FindingDetail, FindingView } from '#core/findingView.ts'
import { compareInbox } from '#core/inbox.ts'
import type { KevDetails, KevSourceKind } from '#core/kev.ts'

import { createKevRefresher } from '#server/kev/kevRefresher.ts'
import { readMockKevFeed } from '#server/sources/mock/mockKevFeed.ts'

import { quiet, requestJson, syncedTestApp, TEST_NOW } from '#server/http/__tests__/appFixtures.ts'

/**
 * Syncs the mock data with a KEV source, stores the fixture catalog and reads the catalog
 * entries of a KEV listed and an unlisted finding.
 * @param {KevSourceKind} kevSource - KEV source
 * @returns {Promise<{ listed: KevDetails | null; other: KevDetails | null }>} - Entries of both details
 */
const kevDetailsWith = async (
  kevSource: KevSourceKind,
): Promise<{ listed: KevDetails | null; other: KevDetails | null }> => {
  const { app, deps } = await syncedTestApp({ kevSource })

  await createKevRefresher({
    db: deps.db,
    clock: () => TEST_NOW,
    log: quiet,
    loadFeed: () => readMockKevFeed(),
  }).refresh()

  const findings = (await requestJson<FindingView[]>(app, '/api/findings')).body
  /**
   * Reads the catalog entry of a finding detail.
   * @param {FindingView | undefined} finding - Finding
   * @returns {Promise<KevDetails | null>} - Entry
   */
  const kevOf = async (finding: FindingView | undefined): Promise<KevDetails | null> =>
    (await requestJson<FindingDetail>(app, `/api/findings/${finding?.id}`)).body.kev

  return {
    listed: await kevOf(findings.find((finding) => finding.kev)),
    other: await kevOf(findings.find((finding) => !finding.kev)),
  }
}

describe('finding routes', () => {
  it('lists the inbox in inbox order', async () => {
    const { app } = await syncedTestApp()
    const { status, body } = await requestJson<FindingView[]>(app, '/api/findings?view=inbox')

    expect(status).toBe(200)
    expect(body.length).toBeGreaterThan(100)
    expect(body.every((finding) => finding.inInbox)).toBe(true)
    expect(body.map((finding) => finding.id)).toEqual(
      [...body].sort(compareInbox).map((finding) => finding.id),
    )
  })

  it('filters by severity, exposure, owner and search text', async () => {
    const { app } = await syncedTestApp()
    const { body } = await requestJson<FindingView[]>(
      app,
      '/api/findings?severity=Critical,High&exposure=public&owner=self,third-party&q=CVE',
    )

    expect(body.length).toBeGreaterThan(0)
    expect(
      body.every(
        (finding) =>
          ['Critical', 'High'].includes(finding.severity) &&
          finding.exposure === 'public' &&
          (finding.owner === 'self' || finding.owner === 'third-party'),
      ),
    ).toBe(true)
  })

  it('filters by a free-form owner, URL-encoded, and rejects owners with invalid length', async () => {
    const { app } = await syncedTestApp()
    const platform = (await requestJson<FindingView[]>(app, '/api/findings?owner=%20platform%20'))
      .body
    const tooLong = await requestJson(app, `/api/findings?owner=${'x'.repeat(65)}`)

    expect(platform.length).toBeGreaterThan(0)
    expect(platform.every((finding) => finding.owner === 'platform')).toBe(true)
    expect(tooLong).toEqual({
      status: 400,
      body: { error: 'validation', errors: [{ field: 'owner', code: 'invalid' }] },
    })
  })

  it('rejects unknown filter values with the validation errors', async () => {
    const { app } = await syncedTestApp()

    expect(await requestJson(app, '/api/findings?severity=Severe&view=later')).toEqual({
      status: 400,
      body: {
        error: 'validation',
        errors: [
          { field: 'view', code: 'invalid' },
          { field: 'severity', code: 'invalid' },
        ],
      },
    })
  })

  it('answers the detail of a finding and 404 for unknown ids', async () => {
    const { app } = await syncedTestApp()
    const [first] = (await requestJson<FindingView[]>(app, '/api/findings')).body
    const detail = await requestJson<FindingDetail>(app, `/api/findings/${first?.id}`)

    expect(detail.status).toBe(200)
    expect(detail.body.finding.id).toBe(first?.id)
    expect(detail.body.instances.length).toBeGreaterThan(0)
    expect((await requestJson(app, '/api/findings/999999')).status).toBe(404)
    expect((await requestJson(app, '/api/findings/abc')).status).toBe(404)
  })

  it('adds the catalog entry of a KEV listed finding for the cisa KEV source', async () => {
    const { listed, other } = await kevDetailsWith('cisa')

    expect(listed).toMatchObject({
      dateAdded: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      requiredAction: expect.stringContaining('Apply mitigations'),
      knownRansomware: expect.any(Boolean),
    })
    expect(other).toBeNull()
  })

  it('leaves the catalog entry out for the prometheus KEV source', async () => {
    expect(await kevDetailsWith('prometheus')).toEqual({ listed: null, other: null })
  })

  it('reports no finding as KEV listed for the KEV source none', async () => {
    const { app } = await syncedTestApp({ kevSource: 'none' })
    const findings = (await requestJson<FindingView[]>(app, '/api/findings')).body

    expect(findings.length).toBeGreaterThan(0)
    expect(findings.some((finding) => finding.kev)).toBe(false)
  })
})
