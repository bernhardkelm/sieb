import type {
  ExpiringInboxItem,
  KevInboxItem,
  ProposalInboxItem,
  ReopenedInboxItem,
} from '#core/inbox/inboxItem.ts'

export const DAY_MS = 24 * 60 * 60 * 1000
const BASE = 'https://sieb.example.com'
const NGINX = 'index.docker.io/library/nginx'

/**
 * Returns the ISO time a number of days from the real current time, a minute further out so
 * whole-day texts stay stable while the test runs.
 * @param {number} days - Offset, negative for the past
 * @returns {string} - ISO time
 */
export const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * DAY_MS + Math.sign(days) * 60 * 1000).toISOString()

/**
 * Builds an open proposal item.
 * @param {number} id - Proposal id
 * @param {Partial<ProposalInboxItem>} overrides - Fields to set
 * @returns {ProposalInboxItem} - Item
 */
export const proposalItem = (
  id: number,
  overrides: Partial<ProposalInboxItem> = {},
): ProposalInboxItem => ({
  kind: 'proposal',
  key: `proposal:${id}`,
  at: daysFromNow(-1),
  vulnId: `CVE-2025-${1000 + id}`,
  imageRef: null,
  severity: 'High',
  kev: false,
  title: 'Heap overflow in a parser',
  exposure: null,
  owners: [],
  packages: [],
  namespaces: [],
  url: `${BASE}/inbox/proposals/${id}`,
  refs: { proposalId: id },
  imageRefs: null,
  verdict: 'not_affected',
  confidence: 'high',
  patchAction: null,
  upstreamPending: false,
  clientKind: 'claude_code_cli',
  clientLabel: 'laptop',
  agent: null,
  imageCount: 3,
  currentDecisionIds: [{ imageRef: null, decisionId: null, updatedAt: null }],
  outdated: false,
  ...overrides,
})

/**
 * Builds a re-opened decision item.
 * @param {number} decisionId - Decision id
 * @param {Partial<ReopenedInboxItem>} overrides - Fields to set
 * @returns {ReopenedInboxItem} - Item
 */
export const reopenedItem = (
  decisionId: number,
  overrides: Partial<ReopenedInboxItem> = {},
): ReopenedInboxItem => ({
  kind: 'reopened',
  key: `reopened:${decisionId}:pending`,
  at: daysFromNow(-2),
  vulnId: `CVE-2025-${2000 + decisionId}`,
  imageRef: NGINX,
  severity: 'Critical',
  kev: false,
  title: null,
  exposure: null,
  owners: [],
  packages: [],
  namespaces: [],
  url: `${BASE}/triage?finding=${decisionId}`,
  refs: { decisionId, findingId: decisionId },
  decisionStatus: 'accepted',
  reopenReason: 'severity_rose',
  ...overrides,
})

/**
 * Builds an expiring decision item.
 * @param {number} decisionId - Decision id
 * @param {Partial<ExpiringInboxItem>} overrides - Fields to set
 * @returns {ExpiringInboxItem} - Item
 */
export const expiringItem = (
  decisionId: number,
  overrides: Partial<ExpiringInboxItem> = {},
): ExpiringInboxItem => {
  const at = overrides.at ?? daysFromNow(5)

  return {
    kind: 'expiring',
    key: `expiring:${decisionId}:${at}`,
    at,
    vulnId: `CVE-2025-${3000 + decisionId}`,
    imageRef: NGINX,
    severity: 'Medium',
    kev: false,
    title: null,
    exposure: null,
    owners: [],
    packages: [],
    namespaces: [],
    url: `${BASE}/triage?finding=${decisionId}`,
    refs: { decisionId, findingId: decisionId },
    decisionStatus: 'not_affected',
    ...overrides,
  }
}

/**
 * Builds a new KEV listing item.
 * @param {number} findingId - Finding id
 * @param {Partial<KevInboxItem>} overrides - Fields to set
 * @returns {KevInboxItem} - Item
 */
export const kevItem = (
  findingId: number,
  overrides: Partial<KevInboxItem> = {},
): KevInboxItem => ({
  kind: 'kev',
  key: `kev:${findingId}`,
  at: daysFromNow(-3),
  vulnId: `CVE-2025-${4000 + findingId}`,
  imageRef: NGINX,
  severity: 'High',
  kev: true,
  title: null,
  exposure: null,
  owners: [],
  packages: [],
  namespaces: [],
  url: `${BASE}/triage?finding=${findingId}`,
  refs: { findingId, decisionId: null },
  decisionStatus: null,
  ...overrides,
})
