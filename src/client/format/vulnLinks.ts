import type { Finding } from '#core/finding.ts'

export interface VulnLink {
  label: string
  href: string
}

const WEB_PROTOCOLS = ['http:', 'https:']

/**
 * Returns whether a link from the scanner is an absolute http or https URL, the only kind the
 * panel renders, so a javascript: or data: link never becomes clickable.
 * @param {string} href - Link
 * @returns {boolean} - True for http and https URLs
 */
export const isWebUrl = (href: string): boolean => {
  try {
    return WEB_PROTOCOLS.includes(new URL(href).protocol)
  } catch {
    return false
  }
}

/**
 * Returns the reference links of a vulnerability: NVD for CVE ids, GitHub for GHSA ids, osv.dev
 * for Go ids, the KEV catalog when listed and the primary link of the scanner when it is a web
 * URL.
 * @param {Pick<Finding, 'vulnId' | 'kev' | 'primaryLink'>} finding - Finding
 * @returns {VulnLink[]} - Links without duplicates
 */
export const vulnLinks = (finding: Pick<Finding, 'vulnId' | 'kev' | 'primaryLink'>): VulnLink[] => {
  const id = encodeURIComponent(finding.vulnId)
  const links: VulnLink[] = []

  if (finding.vulnId.startsWith('CVE-')) {
    links.push({ label: 'NVD', href: `https://nvd.nist.gov/vuln/detail/${id}` })
  }

  if (finding.vulnId.startsWith('GHSA-')) {
    links.push({ label: 'GitHub advisory', href: `https://github.com/advisories/${id}` })
  }

  if (finding.vulnId.startsWith('GO-')) {
    links.push({ label: 'osv.dev', href: `https://osv.dev/vulnerability/${id}` })
  }

  if (finding.kev) {
    links.push({
      label: 'KEV catalog',
      href: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${id}`,
    })
  }

  if (
    finding.primaryLink &&
    isWebUrl(finding.primaryLink) &&
    !links.some((link) => link.href === finding.primaryLink)
  ) {
    links.push({ label: 'Advisory', href: finding.primaryLink })
  }

  return links
}
