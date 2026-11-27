import { z } from 'zod'

import { DECISION_JUSTIFICATIONS } from '#core/decision.ts'
import { PATCH_ACTION_HINT } from '#core/patchAction.ts'
import {
  EVIDENCE_BASES,
  FIX_AVAILABILITIES,
  PATCH_LAYERS,
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
  verdict: z
    .enum(PROPOSAL_VERDICTS)
    .describe(
      'needs_patch becomes fix_planned with the patch action; no fix published at a layer the' +
        ' operator controls: fix_planned with fix.availability upstream_pending, not needs_patch.' +
        ' KEV listed: prefer needs_patch or fix_planned over accepted, not_affected only with' +
        ' strong evidence. Code that never runs in the' +
        ' workload (an unused tool, an unloaded library or module): not_affected,' +
        ' vulnerable_code_not_in_execute_path. Running but practically unreachable, with an' +
        ' upgrade as the fix: needs_patch or fix_planned, not not_affected.' +
        ' inconclusive: the evidence supports no verdict or required data could not be obtained;' +
        ' needs missing, never becomes a decision. Thin evidence that still supports a verdict is' +
        ' that verdict with confidence low',
    ),
  justification: z
    .enum(DECISION_JUSTIFICATIONS)
    .optional()
    .describe('OpenVEX, required with not_affected only'),
  summary: text(LIMITS.summary).describe('one or two plain sentences, the answer in short'),
  confidence: z
    .enum(PROPOSAL_CONFIDENCES)
    .describe(
      'low for thin evidence that still supports the verdict; medium at most for a private image' +
        ' you could not inspect',
    ),
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
        check: text(LIMITS.evidenceCheck).describe('what you checked'),
        method: text(LIMITS.evidenceMethod).describe('how: command, file:line, tool call or URL'),
        result: text(LIMITS.evidenceResult).describe('what it showed, "no match" included'),
      }),
    )
    .max(LIMITS.evidenceItems)
    .optional()
    .describe(
      'one entry per check you ran, also for checks that found nothing; never empty when you' +
        ' checked anything',
    ),
  fix: z
    .object({
      action: text(LIMITS.fixAction)
        .optional()
        .describe(
          'required for needs_patch and fix_planned: what the operator does now, true to what' +
            ' the build references today, never a lookup ("check the release notes"): look it up' +
            ` yourself and name the release, tag or digest. ${PATCH_ACTION_HINT}`,
        ),
      layer: z
        .enum(PATCH_LAYERS)
        .optional()
        .describe('layer that ships the vulnerable component, where the action applies'),
      fixedVersion: text(LIMITS.fixVersion).optional().describe('fixed package version'),
      change: text(LIMITS.fixChange)
        .optional()
        .describe(
          'the ordered steps with exact versions, tags, digests, file names and commands,' +
            ' through deploy and how to confirm; only steps the operator carries out, no lookups;' +
            ' say so when no file has to change',
        ),
      effort: text(LIMITS.fixEffort)
        .optional()
        .describe(
          'rough effort and what it touches, e.g. "rebuild and deploy, about 15 minutes, no code' +
            ' change"',
        ),
      availability: z
        .enum(FIX_AVAILABILITIES)
        .optional()
        .describe(
          'available: a fix is published today at a layer you control; upstream_pending: none' +
            ' yet, needs waitingFor and a review date. Decide it from release pages you read, not' +
            ' from a guess',
        ),
      waitingFor: text(LIMITS.waitingFor)
        .optional()
        .describe(
          'with upstream_pending: exactly which release or image you wait for, e.g. "k3s release' +
            ' bundling traefik 3.7.17 or later"',
        ),
      interim: z
        .object({
          action: text(LIMITS.interimAction),
          steps: text(LIMITS.interimSteps).optional(),
          caveats: text(LIMITS.interimCaveats),
        })
        .optional()
        .describe(
          'only with upstream_pending and only when urgent (KEV listed, or critical or high and' +
            ' reachable on a public workload): an advised manual workaround or mitigation until' +
            ' upstream ships; caveats say what it risks and when to revert',
        ),
    })
    .optional(),
  review: z
    .object({
      date: z
        .string()
        .max(40)
        .optional()
        .describe(
          'YYYY-MM-DD or ISO date-time, becomes the expiry; required with upstream_pending, the' +
            ' day to look for the awaited release again',
        ),
      why: text(LIMITS.reviewWhy).optional(),
    })
    .optional(),
  unknowns: z
    .array(text(LIMITS.unknown))
    .max(LIMITS.unknownItems)
    .optional()
    .describe(
      'only what your access could not check, each with the reason ("own registry not' +
        ' pullable", "no kubectl exec"); check whatever a readable file or available tool can' +
        ' answer instead of listing it',
    ),
  missing: z
    .array(text(LIMITS.missing))
    .max(LIMITS.missingItems)
    .optional()
    .describe(
      'required with inconclusive only: what would be needed to decide, one entry each, e.g.' +
        ' "pull access to registry.example.com/app", "advisory text not reachable", "runtime' +
        ' check of the loaded modules"',
    ),
  references: z
    .array(text(LIMITS.reference))
    .max(LIMITS.references)
    .optional()
    .describe(
      'http(s) links of the advisory, fix and release pages you actually read, every page a' +
        ' deciding fact rests on; never a search result or a page that came back empty',
    ),
  evidenceBasis: z
    .array(z.enum(EVIDENCE_BASES))
    .min(1)
    .describe(
      "only what you checked yourself. advisory: advisories, changelogs and sieb's data, its Trivy" +
        " findings included; upstream_source: the upstream project's code; image: you inspected" +
        " the image's files or config yourself; own_source: you read the repository that builds" +
        ' the image; runtime: you observed the running workload. advisory alone for private' +
        ' images you cannot inspect',
    ),
  relatedFindings: z
    .array(
      z.object({
        findingId: z.number().int().positive(),
        note: text(LIMITS.relatedNote).optional().describe('what you checked for this one'),
      }),
    )
    .max(LIMITS.relatedFindings)
    .optional()
    .describe(
      'other open findings you verified share this cause (e.g. the same pseudo-version false' +
        ' positive on the same image), with a note each; never guessed, each one checked against' +
        ' its own CVE and version; the human decides them separately',
    ),
  relatedReason: text(LIMITS.relatedReason)
    .optional()
    .describe('with relatedFindings: the shared cause in one sentence'),
  agent: text(LIMITS.agent).optional().describe('your client, e.g. Claude Code'),
})
