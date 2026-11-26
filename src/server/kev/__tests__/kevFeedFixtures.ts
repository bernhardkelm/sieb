import type { KevFeed } from '#server/kev/parseKevFeed.ts'

/**
 * Builds a raw feed entry as the CISA feed lists it.
 * @param {string} cveId - CVE id
 * @param {Record<string, unknown>} overrides - Fields to replace
 * @returns {Record<string, unknown>} - Entry
 */
export const rawKevEntry = (
  cveId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  cveID: cveId,
  vendorProject: 'Example',
  product: 'Gateway',
  vulnerabilityName: 'Example Gateway Path Traversal Vulnerability',
  dateAdded: '2026-11-03',
  shortDescription: 'Example Gateway contains a path traversal vulnerability.',
  requiredAction: 'Apply mitigations per vendor instructions.',
  dueDate: '2026-11-24',
  knownRansomwareCampaignUse: 'Known',
  notes: 'https://example.com/advisory',
  cwes: ['CWE-22'],
  ...overrides,
})

/**
 * Builds a raw feed with the top-level fields of the CISA feed.
 * @param {readonly unknown[]} entries - Vulnerabilities list
 * @param {Record<string, unknown>} overrides - Top-level fields to replace
 * @returns {Record<string, unknown>} - Feed
 */
export const rawKevFeed = (
  entries: readonly unknown[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  title: 'CISA Catalog of Known Exploited Vulnerabilities',
  catalogVersion: '2026.11.24',
  dateReleased: '2026-11-24T17:01:02.1234Z',
  count: entries.length,
  vulnerabilities: entries,
  ...overrides,
})

/**
 * Builds a validated feed of CVE ids with default details.
 * @param {readonly string[]} cveIds - Listed CVE ids
 * @param {string} catalogVersion - Catalog version
 * @returns {KevFeed} - Feed
 */
export const kevFeedOf = (cveIds: readonly string[], catalogVersion = '2026.11.24'): KevFeed => ({
  catalogVersion,
  dateReleased: '2026-11-24T17:01:02.1234Z',
  entries: cveIds.map((cveId) => ({
    cveId,
    vendorProject: 'Example',
    product: 'Gateway',
    vulnerabilityName: `${cveId} name`,
    dateAdded: '2026-11-03',
    shortDescription: null,
    requiredAction: 'Apply mitigations per vendor instructions.',
    dueDate: '2026-11-24',
    knownRansomware: false,
    notes: null,
  })),
  skipped: 0,
})
