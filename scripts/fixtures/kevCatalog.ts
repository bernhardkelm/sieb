import type { FixtureCve, FixtureModel } from '#scripts/fixtures/fixtureModel.ts'
import { entryDetails } from '#scripts/fixtures/kevEntryDetails.ts'
import type { Random } from '#scripts/fixtures/random.ts'

export interface KevCatalogMeta {
  catalogVersion: string
  dateReleased: string
  dateAdded: (random: Random) => string // YYYY-MM-DD per entry
}

const FAMILY_PRODUCTS: Readonly<Record<string, readonly [string, string]>> = {
  openssl: ['OpenSSL', 'OpenSSL'],
  curl: ['Haxx', 'curl'],
  busybox: ['BusyBox', 'BusyBox'],
  libxml2: ['xmlsoft', 'libxml2'],
  zlib: ['zlib', 'zlib'],
  musl: ['musl libc', 'musl'],
  glibc: ['GNU', 'GNU C Library'],
  krb5: ['MIT', 'Kerberos 5'],
  perl: ['Perl', 'Perl'],
  stdlib: ['Go', 'Go standard library'],
  xnet: ['Go', 'golang.org/x/net'],
  grpc: ['gRPC', 'grpc-go'],
  jwt: ['golang-jwt', 'jwt'],
  npm: ['npm', 'Node.js packages'],
  pypi: ['Python Packaging Authority', 'Python packages'],
}

const DECOY_PRODUCTS: readonly (readonly [string, string])[] = [
  ['Example Networks', 'Edge Gateway'],
  ['Sample Systems', 'Remote Access VPN'],
  ['Placeholder Software', 'Managed File Transfer'],
  ['Demo Labs', 'Content Management System'],
  ['Acme Devices', 'Router Firmware'],
  ['Generic Messaging', 'Mail Server'],
]

export const REQUIRED_ACTION =
  'Apply mitigations per vendor instructions, follow applicable BOD 22-01 guidance for cloud ' +
  'services, or discontinue use of the product if mitigations are unavailable.'

/**
 * Adds days to a YYYY-MM-DD date.
 * @param {string} date - Date
 * @param {number} days - Days to add
 * @returns {string} - Date
 */
const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

/**
 * Builds one catalog entry in the shape of the CISA feed. CVEs of the model get the vendor and
 * product of their family and details from their title, the others an invented product and flaw.
 * @param {string} cveId - Listed CVE id
 * @param {ReadonlyMap<string, FixtureCve>} cves - CVEs of the model by id
 * @param {Random} random - Generator
 * @param {string} dateAdded - Listing date
 * @returns {Record<string, unknown>} - Feed entry
 */
const kevEntry = (
  cveId: string,
  cves: ReadonlyMap<string, FixtureCve>,
  random: Random,
  dateAdded: string,
): Record<string, unknown> => {
  const cve = cves.get(cveId)
  const [vendorProject, product] = FAMILY_PRODUCTS[cve?.family ?? ''] ?? random.pick(DECOY_PRODUCTS)
  const name = product.startsWith(vendorProject) ? product : `${vendorProject} ${product}`
  const { vulnerabilityName, shortDescription, cwes } = entryDetails(name, cve, random)

  return {
    cveID: cveId,
    vendorProject,
    product,
    vulnerabilityName,
    dateAdded,
    shortDescription,
    requiredAction: REQUIRED_ACTION,
    dueDate: addDays(dateAdded, 21),
    knownRansomwareCampaignUse: random.chance(0.25) ? 'Known' : 'Unknown',
    notes: `https://nvd.nist.gov/vuln/detail/${cveId}`,
    cwes,
  }
}

/**
 * Builds the feed entries of the listed CVE ids, in id order.
 * @param {readonly string[]} cveIds - Listed CVE ids
 * @param {FixtureModel} model - Model, for the family and title of its CVEs
 * @param {Random} random - Generator, separate from the one of the findings
 * @param {KevCatalogMeta} meta - Catalog version, release time and listing dates
 * @returns {{ head: Record<string, unknown>; entries: Record<string, unknown>[] }} - Top-level fields and entries
 */
export const kevCatalog = (
  cveIds: readonly string[],
  model: FixtureModel,
  random: Random,
  meta: KevCatalogMeta,
): { head: Record<string, unknown>; entries: Record<string, unknown>[] } => {
  const cves = new Map(model.cves.map((cve) => [cve.id, cve]))
  const entries = [...cveIds]
    .sort()
    .map((cveId) => kevEntry(cveId, cves, random, meta.dateAdded(random)))

  return {
    head: {
      title: 'Synthetic Known Exploited Vulnerabilities Catalog',
      catalogVersion: meta.catalogVersion,
      dateReleased: meta.dateReleased,
      count: entries.length,
    },
    entries,
  }
}
