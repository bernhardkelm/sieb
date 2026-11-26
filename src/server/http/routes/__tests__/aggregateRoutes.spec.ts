// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CveAggregate } from '#core/cveAggregation.ts'
import type { FindingView } from '#core/findingView.ts'
import type { ImageAggregate } from '#core/imageAggregation.ts'

import { requestJson, syncedTestApp } from '#server/http/__tests__/appFixtures.ts'

/**
 * Sums a number over items.
 * @param {readonly T[]} items - Items
 * @param {(item: T) => number} value - Number of an item
 * @returns {number} - Sum
 */
const sum = <T>(items: readonly T[], value: (item: T) => number): number =>
  items.reduce((total, item) => total + value(item), 0)

describe('image and CVE routes', () => {
  it('aggregates every open finding once per image and once per CVE', async () => {
    const { app } = await syncedTestApp()
    const findings = (await requestJson<FindingView[]>(app, '/api/findings')).body
    const images = (await requestJson<ImageAggregate[]>(app, '/api/images')).body
    const cves = (await requestJson<CveAggregate[]>(app, '/api/cves')).body
    const inbox = findings.filter((finding) => finding.inInbox).length

    expect(sum(images, (image) => image.openCount)).toBe(findings.length)
    expect(sum(images, (image) => image.inboxCount)).toBe(inbox)
    expect(sum(cves, (cve) => cve.openCount)).toBe(findings.length)
    expect(sum(cves, (cve) => cve.decisionStates.undecided)).toBe(inbox)
    expect(images[0]?.owner).toBe('self')
    expect(cves.some((cve) => cve.kev)).toBe(true)
    expect(cves[0]?.kev).toBe(true)
  })
})
