// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { MAX_KEV_TEXT_LENGTH, parseKevFeed } from '#server/kev/parseKevFeed.ts'

import { rawKevEntry, rawKevFeed } from '#server/kev/__tests__/kevFeedFixtures.ts'

describe('parseKevFeed', () => {
  it('maps the entries and the catalog version of a valid feed', () => {
    const feed = parseKevFeed(
      rawKevFeed([
        rawKevEntry('CVE-2024-3400'),
        rawKevEntry('cve-2021-44228', { knownRansomwareCampaignUse: 'Unknown', dueDate: 'soon' }),
      ]),
    )

    expect(feed).toMatchObject({ catalogVersion: '2026.11.24', skipped: 0 })
    expect(feed.entries).toEqual([
      {
        cveId: 'CVE-2024-3400',
        vendorProject: 'Example',
        product: 'Gateway',
        vulnerabilityName: 'Example Gateway Path Traversal Vulnerability',
        dateAdded: '2026-11-03',
        shortDescription: 'Example Gateway contains a path traversal vulnerability.',
        requiredAction: 'Apply mitigations per vendor instructions.',
        dueDate: '2026-11-24',
        knownRansomware: true,
        notes: 'https://example.com/advisory',
      },
      expect.objectContaining({ cveId: 'CVE-2021-44228', knownRansomware: false, dueDate: null }),
    ])
  })

  it('skips malformed and repeated entries, blank texts become null and long ones are capped', () => {
    const feed = parseKevFeed(
      rawKevFeed([
        rawKevEntry('CVE-2024-1000', { notes: ' ', shortDescription: 'x'.repeat(9000) }),
        rawKevEntry('CVE-2024-1000', { product: 'Other' }),
        rawKevEntry('GHSA-xxxx-yyyy'),
        rawKevEntry('CVE-2024-2000', { dateAdded: '03/11/2026' }),
        rawKevEntry('CVE-2024-3000', { knownRansomwareCampaignUse: 'maybe', vendorProject: 7 }),
        'not an entry',
        null,
      ]),
    )

    expect(feed.entries.map((entry) => entry.cveId)).toEqual(['CVE-2024-1000', 'CVE-2024-3000'])
    expect(feed.entries[0]).toMatchObject({ product: 'Gateway', notes: null })
    expect(feed.entries[0]?.shortDescription).toHaveLength(MAX_KEV_TEXT_LENGTH)
    expect(feed.entries[1]).toMatchObject({ knownRansomware: null, vendorProject: null })
    expect(feed.skipped).toBe(5)
  })

  it.each([
    ['not an object', 'nope', /no vulnerabilities list/],
    [
      'a renamed list',
      { catalogVersion: '1', vulns: [rawKevEntry('CVE-2024-1')] },
      /no vulnerabilities list/,
    ],
    ['an empty list', rawKevFeed([]), /no valid entry/],
    ['only invalid entries', rawKevFeed([{ cve: 'CVE-2024-1' }]), /no valid entry/],
    [
      'a count that disagrees with the list',
      rawKevFeed([rawKevEntry('CVE-2024-1000')], { count: 1400 }),
      /count 1400 does not match its 1 entries/,
    ],
  ])('rejects %s', (_, json, message) => {
    expect(() => parseKevFeed(json)).toThrow(message)
  })
})
