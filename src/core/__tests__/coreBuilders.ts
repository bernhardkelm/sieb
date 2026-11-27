import type { Decision } from '#core/decision.ts'
import type { Finding } from '#core/finding.ts'
import type { FindingView } from '#core/findingView.ts'
import type { DecisionBaseline } from '#core/reopenTrigger.ts'
import type { SourceInstance } from '#core/sourceSnapshot.ts'

export const NOW = new Date('2026-06-01T12:00:00.000Z')

/**
 * Builds a baseline with neutral defaults.
 * @param {Partial<DecisionBaseline>} overrides - Fields to set
 * @returns {DecisionBaseline} - Baseline
 */
export const buildBaseline = (overrides: Partial<DecisionBaseline> = {}): DecisionBaseline => ({
  imageRef: 'index.docker.io/library/nginx',
  severity: 'High',
  kev: false,
  recordedAt: '2026-05-01T00:00:00.000Z',
  ...overrides,
})

/**
 * Builds a decision with neutral defaults. Without explicit baselines it gets one for its image
 * from severityAtDecision and kevAtDecision, nginx for scope all.
 * @param {Partial<Decision>} overrides - Fields to set
 * @returns {Decision} - Decision
 */
export const buildDecision = (overrides: Partial<Decision> = {}): Decision => ({
  id: 1,
  vulnId: 'CVE-2025-1000',
  scope: 'image',
  imageRef: 'index.docker.io/library/nginx',
  status: 'not_affected',
  justification: null,
  reason: 'not reachable',
  expiresAt: null,
  upstreamPending: false,
  waitingFor: null,
  createdBy: 'dev',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  revokedAt: null,
  revokedBy: null,
  severityAtDecision: 'High',
  kevAtDecision: false,
  reopenedAt: null,
  reopenTrigger: null,
  baselines: [
    buildBaseline({
      imageRef: overrides.imageRef ?? 'index.docker.io/library/nginx',
      severity: overrides.severityAtDecision ?? 'High',
      kev: overrides.kevAtDecision ?? false,
    }),
  ],
  ...overrides,
})

/**
 * Builds an open finding with neutral defaults.
 * @param {Partial<Finding>} overrides - Fields to set
 * @returns {Finding} - Finding
 */
export const buildFinding = (overrides: Partial<Finding> = {}): Finding => ({
  id: 1,
  vulnId: 'CVE-2025-1000',
  imageRef: 'index.docker.io/library/nginx',
  severity: 'High',
  score: 7.5,
  severitySource: null,
  kev: false,
  exposure: 'internal',
  owner: 'third-party',
  title: null,
  primaryLink: null,
  firstSeen: '2026-05-01T00:00:00.000Z',
  lastSeen: '2026-06-01T00:00:00.000Z',
  resolvedAt: null,
  ...overrides,
})

/**
 * Builds a source row with neutral defaults.
 * @param {Partial<SourceInstance>} overrides - Fields to set
 * @returns {SourceInstance} - Source row
 */
export const buildSourceInstance = (overrides: Partial<SourceInstance> = {}): SourceInstance => ({
  vulnId: 'CVE-2025-1000',
  imageRef: 'index.docker.io/library/nginx',
  namespace: 'shop',
  resourceKind: 'ReplicaSet',
  resourceName: 'web-6d4f',
  container: 'web',
  imageTag: '1.27.0',
  imageDigest: null,
  package: 'libssl3',
  installedVersion: '3.0.1',
  fixedVersion: '3.0.2',
  locations: [],
  packageType: null,
  packageClass: null,
  purl: null,
  severity: 'High',
  score: 7.5,
  severitySource: null,
  exposure: 'internal',
  owner: 'third-party',
  title: null,
  primaryLink: null,
  ...overrides,
})

/**
 * Builds an undecided open finding view with one workload.
 * @param {Partial<FindingView>} overrides - Fields to set
 * @returns {FindingView} - Finding view
 */
export const buildFindingView = (overrides: Partial<FindingView> = {}): FindingView => ({
  ...buildFinding(),
  instanceCount: 1,
  workloadCount: 1,
  namespaces: ['shop'],
  workloads: ['shop/ReplicaSet/web-6d4f'],
  packages: ['libssl3'],
  fixable: true,
  decision: null,
  effective: null,
  inInbox: true,
  ...overrides,
})
