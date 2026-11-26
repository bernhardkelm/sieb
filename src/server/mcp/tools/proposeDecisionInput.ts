import { z } from 'zod'

import { DECISION_JUSTIFICATIONS } from '#core/decision.ts'
import {
  EVIDENCE_BASES,
  PROPOSAL_CONFIDENCES,
  PROPOSAL_LIMITS as LIMITS,
  PROPOSAL_VERDICTS,
} from '#core/proposal.ts'

/**
 * Returns a string schema with a length cap.
 * @param {number} max - Longest allowed text
 * @returns {z.ZodString} - Schema
 */
const text = (max: number): z.ZodString => z.string().max(max)

/** Input of propose_decision, caps from PROPOSAL_LIMITS, the core validation stays authoritative */
export const proposeDecisionInput = z.object({
  findingId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('one finding, alone: never with vulnId, imageRefs or all'),
  vulnId: z.string().trim().min(1).max(LIMITS.vulnId).optional(),
  imageRefs: z
    .array(z.string().trim().min(1).max(LIMITS.imageRef))
    .min(1)
    .max(LIMITS.imageRefs)
    .optional()
    .describe('with vulnId: images of the CVE, tag or digest is ignored'),
  all: z.boolean().optional().describe('with vulnId: every image, an all-scope decision'),
  verdict: z.enum(PROPOSAL_VERDICTS).describe('needs_patch becomes fix_planned with the fix path'),
  justification: z
    .enum(DECISION_JUSTIFICATIONS)
    .optional()
    .describe('OpenVEX, required with not_affected only'),
  summary: text(LIMITS.summary).describe('one or two plain sentences, the answer in short'),
  confidence: z.enum(PROPOSAL_CONFIDENCES),
  presence: text(LIMITS.narrative)
    .optional()
    .describe('is the vulnerable component there, per image'),
  reachability: text(LIMITS.narrative)
    .optional()
    .describe('reachable code, attacker-controlled input, preconditions'),
  exposure: text(LIMITS.narrative)
    .optional()
    .describe('how the workload is exposed and what that means here'),
  evidence: z
    .array(
      z.object({
        check: text(LIMITS.evidenceCheck),
        method: text(LIMITS.evidenceMethod).describe('command, file:line or link'),
        result: text(LIMITS.evidenceResult),
      }),
    )
    .max(LIMITS.evidenceItems)
    .optional(),
  fix: z
    .object({
      fixedVersion: text(LIMITS.fixVersion).optional(),
      change: text(LIMITS.fixChange)
        .optional()
        .describe('image tag, dependency or pull request, required for needs_patch'),
      effort: text(LIMITS.fixEffort).optional(),
    })
    .optional(),
  review: z
    .object({
      date: z
        .string()
        .max(40)
        .optional()
        .describe('YYYY-MM-DD or ISO date-time, becomes the expiry'),
      why: text(LIMITS.reviewWhy).optional(),
    })
    .optional(),
  unknowns: z.array(text(LIMITS.unknown)).max(LIMITS.unknownItems).optional(),
  references: z
    .array(text(LIMITS.reference))
    .max(LIMITS.references)
    .optional()
    .describe('http(s) links'),
  evidenceBasis: z
    .array(z.enum(EVIDENCE_BASES))
    .min(1)
    .describe(
      'only what you actually checked; advisory alone for private images you cannot inspect',
    ),
  agent: text(LIMITS.agent).optional().describe('your client, e.g. Claude Code'),
})
