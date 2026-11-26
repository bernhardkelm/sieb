import type { EffectiveDecision } from '#core/effectiveDecision.ts'

type Reopened = Extract<EffectiveDecision, { state: 'reopened' }>

/**
 * Builds the state of a re-opened decision: nginx rose from Low to Critical, latched by a sync.
 * @param {Partial<Reopened>} overrides - Fields to set
 * @returns {Reopened} - Re-opened state
 */
export const reopenedEffective = (overrides: Partial<Reopened> = {}): Reopened => ({
  state: 'reopened',
  reopenedAt: '2026-05-31T00:00:00.000Z',
  reason: 'severity_rose',
  imageRef: 'index.docker.io/library/nginx',
  severity: 'Critical',
  kev: false,
  baselineSeverity: 'Low',
  baselineKev: false,
  ...overrides,
})
