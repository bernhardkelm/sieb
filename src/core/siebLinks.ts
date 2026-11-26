import type { DecisionState } from '#core/effectiveDecision.ts'

/**
 * Normalises the base URL of sieb for links.
 * @param {string} baseUrl - Absolute origin sieb is reached at
 * @returns {string} - Base without trailing slash
 */
export const linkBase = (baseUrl: string): string => baseUrl.replace(/\/+$/, '')

/**
 * Returns the link that opens a finding in the side panel of the Triage view.
 * @param {string} base - Link base from linkBase
 * @param {number} findingId - Finding id
 * @returns {string} - URL
 */
export const findingUrl = (base: string, findingId: number): string =>
  `${base}/triage?finding=${findingId}`

/**
 * Returns the link that expands an image on the by-image view.
 * @param {string} base - Link base from linkBase
 * @param {string} imageRef - Image ref
 * @returns {string} - URL
 */
export const imageUrl = (base: string, imageRef: string): string =>
  `${base}/images?image=${encodeURIComponent(imageRef)}`

/**
 * Returns the link that expands a vulnerability on the by-CVE view.
 * @param {string} base - Link base from linkBase
 * @param {string} vulnId - Vulnerability id
 * @returns {string} - URL
 */
export const cveUrl = (base: string, vulnId: string): string =>
  `${base}/cves?cve=${encodeURIComponent(vulnId)}`

/**
 * Returns the link that expands a decision on the tab of its state of the decisions view.
 * @param {string} base - Link base from linkBase
 * @param {number} decisionId - Decision id
 * @param {DecisionState} state - Current state of the decision
 * @returns {string} - URL
 */
export const decisionUrl = (base: string, decisionId: number, state: DecisionState): string =>
  `${base}/decisions?state=${state}&decision=${decisionId}`

/**
 * Returns the link of the Inbox, what waits for the user.
 * @param {string} base - Link base from linkBase
 * @returns {string} - URL
 */
export const inboxUrl = (base: string): string => `${base}/inbox`
