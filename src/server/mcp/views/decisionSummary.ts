import { z } from 'zod'

import { DECISION_JUSTIFICATIONS, DECISION_SCOPES, DECISION_STATUSES } from '#core/decision.ts'
import { DECISION_STATES } from '#core/decisionStates.ts'
import type { DecisionView } from '#core/findingView.ts'
import { SEVERITIES } from '#core/severity.ts'
import { decisionUrl } from '#core/siebLinks.ts'

export const decisionSummarySchema = z.object({
  id: z.number().int(),
  vulnId: z.string(),
  scope: z.enum(DECISION_SCOPES).describe('image: one image, all: every image without its own'),
  imageRef: z.string().nullable(),
  status: z.enum(DECISION_STATUSES),
  justification: z.enum(DECISION_JUSTIFICATIONS).nullable().describe('OpenVEX, not_affected only'),
  state: z.enum(DECISION_STATES).describe('active not_affected and accepted mute alerts'),
  expiresAt: z.string().nullable(),
  upstreamPending: z
    .boolean()
    .describe('fix_planned waiting for an upstream release, expiresAt is its review date'),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  revokedAt: z.string().nullable(),
  reopened: z
    .object({
      reason: z.enum(['severity_rose', 'kev_listed']),
      imageRef: z.string(),
      severity: z.enum(SEVERITIES),
      kev: z.boolean(),
    })
    .nullable(),
  openFindings: z.number().int().describe('open findings it governs'),
  url: z.string(),
  untrusted: z.object({
    reason: z.string().describe('free text written by a sieb user'),
    waitingFor: z
      .string()
      .nullable()
      .describe('with upstreamPending: the release or image awaited, free text'),
  }),
})

export type DecisionSummary = z.infer<typeof decisionSummarySchema>

/**
 * Builds the compact summary of a decision, its user-written reason and waitingFor under
 * untrusted.
 * @param {DecisionView} view - Decision with its state
 * @param {string} base - Link base
 * @returns {DecisionSummary} - Summary
 */
export const toDecisionSummary = (view: DecisionView, base: string): DecisionSummary => {
  const { decision, effective } = view

  return {
    id: decision.id,
    vulnId: decision.vulnId,
    scope: decision.scope,
    imageRef: decision.imageRef,
    status: decision.status,
    justification: decision.justification,
    state: effective.state,
    expiresAt: decision.expiresAt,
    upstreamPending: decision.upstreamPending,
    createdBy: decision.createdBy,
    createdAt: decision.createdAt,
    updatedAt: decision.updatedAt,
    revokedAt: decision.revokedAt,
    reopened:
      effective.state === 'reopened'
        ? {
            reason: effective.reason,
            imageRef: effective.imageRef,
            severity: effective.severity,
            kev: effective.kev,
          }
        : null,
    openFindings: view.openFindings,
    url: decisionUrl(base, decision.id, effective.state),
    untrusted: { reason: decision.reason, waitingFor: decision.waitingFor },
  }
}
