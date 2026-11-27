import type { InboxFinding, InboxProposal } from '#core/inbox/inboxItem.ts'
import { buildInbox, type Inbox, type InboxSources } from '#core/inbox/buildInbox.ts'
import { NOW } from '#core/__tests__/coreBuilders.ts'

export const NGINX = 'index.docker.io/library/nginx'
export const REDIS = 'index.docker.io/library/redis'
export const BASE = 'https://sieb.example.com/'
export const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Returns the ISO time a number of milliseconds from NOW.
 * @param {number} ms - Offset, negative for the past
 * @returns {string} - ISO time
 */
export const fromNow = (ms: number): string => new Date(NOW.getTime() + ms).toISOString()

/**
 * Builds an open Inbox finding with neutral defaults.
 * @param {Partial<InboxFinding>} overrides - Fields to set
 * @returns {InboxFinding} - Finding
 */
export const inboxFinding = (overrides: Partial<InboxFinding> = {}): InboxFinding => ({
  id: 1,
  vulnId: 'CVE-2025-1000',
  imageRef: NGINX,
  severity: 'High',
  kev: false,
  title: null,
  resolvedAt: null,
  kevSince: null,
  ...overrides,
})

/**
 * Builds an open proposal with neutral defaults.
 * @param {Partial<InboxProposal>} overrides - Fields to set
 * @returns {InboxProposal} - Proposal
 */
export const inboxProposal = (overrides: Partial<InboxProposal> = {}): InboxProposal => ({
  id: 1,
  vulnId: 'CVE-2025-1000',
  imageRefs: [NGINX],
  createdAt: fromNow(-DAY_MS),
  verdict: 'not_affected',
  confidence: 'high',
  patchAction: null,
  clientKind: null,
  clientLabel: 'laptop',
  agent: null,
  currentDecisionIds: [{ imageRef: NGINX, decisionId: null, updatedAt: null }],
  outdated: false,
  ...overrides,
})

/**
 * Builds the Inbox at NOW from partial sources.
 * @param {Partial<InboxSources>} sources - Sources to set
 * @returns {Inbox} - Inbox
 */
export const inboxOf = (sources: Partial<InboxSources>): Inbox =>
  buildInbox({
    findings: [],
    decisions: [],
    proposals: [],
    seen: new Map(),
    now: NOW,
    baseUrl: BASE,
    ...sources,
  })
