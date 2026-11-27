/**
 * Hosts WebFetch may reach by default: CVE databases, advisories, source hosting, Go, the distro
 * trackers, the package registries and the image registries. A rule matches its host only, a
 * leading "*." matches every subdomain but not the domain itself.
 */
export const DEFAULT_WEB_DOMAINS = [
  'nvd.nist.gov',
  'services.nvd.nist.gov',
  'cve.org',
  'www.cve.org',
  'cveawg.mitre.org',
  'www.cisa.gov',
  'osv.dev',
  'api.osv.dev',
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com',
  'pkg.go.dev',
  'go.dev',
  'proxy.golang.org',
  'vuln.go.dev',
  'security-tracker.debian.org',
  'tracker.debian.org',
  'ubuntu.com',
  'launchpad.net',
  'security.alpinelinux.org',
  'secdb.alpinelinux.org',
  'pkgs.alpinelinux.org',
  'access.redhat.com',
  'bugzilla.redhat.com',
  'www.npmjs.com',
  'registry.npmjs.org',
  'pypi.org',
  'crates.io',
  'rubygems.org',
  'central.sonatype.com',
  'repo1.maven.org',
  'search.maven.org',
  'hub.docker.com',
  'quay.io',
  'ghcr.io',
]

const DOMAIN_PATTERN = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/**
 * Parses SIEB_CHECKER_WEB_DOMAINS, a comma or whitespace separated list of host names.
 * @param {string | undefined} value - Raw variable
 * @returns {string[]} - Lower-case host names, the defaults when unset or blank
 * @throws {Error} - When an entry is no host name or a "*." pattern of one
 */
export const parseWebDomains = (value: string | undefined): string[] => {
  const entries = (value ?? '')
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')

  if (entries.length === 0) {
    return DEFAULT_WEB_DOMAINS
  }

  const invalid = entries.find((entry) => !DOMAIN_PATTERN.test(entry))

  if (invalid !== undefined) {
    throw new Error(`SIEB_CHECKER_WEB_DOMAINS: "${invalid}" is no host name`)
  }

  return [...new Set(entries)]
}
