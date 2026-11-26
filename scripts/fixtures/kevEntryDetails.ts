import type { FixtureCve } from '#scripts/fixtures/fixtureModel.ts'
import type { Random } from '#scripts/fixtures/random.ts'

const FLAWS: readonly (readonly [string, string, string])[] = [
  ['Improper Authentication', 'bypass authentication', 'CWE-287'],
  ['OS Command Injection', 'execute arbitrary commands', 'CWE-78'],
  ['Use-After-Free', 'execute arbitrary code', 'CWE-416'],
  ['Path Traversal', 'read arbitrary files', 'CWE-22'],
  ['Deserialization of Untrusted Data', 'execute arbitrary code', 'CWE-502'],
  ['Out-of-Bounds Write', 'cause a denial of service or execute code', 'CWE-787'],
  ['Server-Side Request Forgery', 'reach internal services', 'CWE-918'],
]

/**
 * Returns the flaw of a finding title without its component prefix, as in
 * "openssl: timing side channel in RSA decryption".
 * @param {string} title - Finding title
 * @returns {string} - Text after the first colon, the title without one
 */
const titleDetail = (title: string): string => {
  const colon = title.indexOf(': ')

  return colon === -1 ? title : title.slice(colon + 2)
}

/**
 * Returns the name, description and CWEs of a catalog entry. A CVE of the model is described
 * from its finding title, so the KEV details agree with the finding; others get an invented flaw.
 * @param {string} name - Vendor and product name
 * @param {FixtureCve | undefined} cve - CVE of the model, undefined for a decoy
 * @param {Random} random - Generator, drawn from only for a decoy
 * @returns {{ vulnerabilityName: string; shortDescription: string; cwes: string[] }} - Entry details
 */
export const entryDetails = (
  name: string,
  cve: FixtureCve | undefined,
  random: Random,
): { vulnerabilityName: string; shortDescription: string; cwes: string[] } => {
  if (cve) {
    const detail = titleDetail(cve.title)

    return {
      vulnerabilityName: `${name} ${detail} vulnerability`,
      shortDescription: `${name} contains a vulnerability (${detail}) that a remote attacker can exploit.`,
      cwes: [],
    }
  }

  const [flaw, impact, cwe] = random.pick(FLAWS)
  const article = /^[aeiou]/i.test(flaw) ? 'an' : 'a'

  return {
    vulnerabilityName: `${name} ${flaw} Vulnerability`,
    shortDescription: `${name} contains ${article} ${flaw.toLowerCase()} vulnerability that allows a remote attacker to ${impact}.`,
    cwes: [cwe],
  }
}
