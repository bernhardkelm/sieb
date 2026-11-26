import type { FixtureModel } from '#scripts/fixtures/fixtureModel.ts'
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

const FLAWS: readonly (readonly [string, string, string])[] = [
  ['Improper Authentication', 'bypass authentication', 'CWE-287'],
  ['OS Command Injection', 'execute arbitrary commands', 'CWE-78'],
  ['Use-After-Free', 'execute arbitrary code', 'CWE-416'],
  ['Path Traversal', 'read arbitrary files', 'CWE-22'],
  ['Deserialization of Untrusted Data', 'execute arbitrary code', 'CWE-502'],
  ['Out-of-Bounds Write', 'cause a denial of service or execute code', 'CWE-787'],
  ['Server-Side Request Forgery', 'reach internal services', 'CWE-918'],
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
 * product of their family, the others an invented one.
 * @param {string} cveId - Listed CVE id
 * @param {ReadonlyMap<string, string>} families - Family id per CVE id of the model
 * @param {Random} random - Generator
 * @param {string} dateAdded - Listing date
 * @returns {Record<string, unknown>} - Feed entry
 */
const kevEntry = (
  cveId: string,
  families: ReadonlyMap<string, string>,
  random: Random,
  dateAdded: string,
): Record<string, unknown> => {
  const [vendorProject, product] =
    FAMILY_PRODUCTS[families.get(cveId) ?? ''] ?? random.pick(DECOY_PRODUCTS)
  const [flaw, impact, cwe] = random.pick(FLAWS)
  const name = vendorProject === product ? product : `${vendorProject} ${product}`
  const article = /^[aeiou]/i.test(flaw) ? 'an' : 'a'

  return {
    cveID: cveId,
    vendorProject,
    product,
    vulnerabilityName: `${name} ${flaw} Vulnerability`,
    dateAdded,
    shortDescription: `${name} contains ${article} ${flaw.toLowerCase()} vulnerability that allows a remote attacker to ${impact}.`,
    requiredAction: REQUIRED_ACTION,
    dueDate: addDays(dateAdded, 21),
    knownRansomwareCampaignUse: random.chance(0.25) ? 'Known' : 'Unknown',
    notes: `https://nvd.nist.gov/vuln/detail/${cveId}`,
    cwes: [cwe],
  }
}

/**
 * Builds the feed entries of the listed CVE ids, in id order.
 * @param {readonly string[]} cveIds - Listed CVE ids
 * @param {FixtureModel} model - Model, for the family of its CVEs
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
  const families = new Map(model.cves.map((cve) => [cve.id, cve.family]))
  const entries = [...cveIds]
    .sort()
    .map((cveId) => kevEntry(cveId, families, random, meta.dateAdded(random)))

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
