import type { DecisionJustification, DecisionScope } from '#core/decision.ts'
import type {
  EvidenceBasis,
  ProposalConfidence,
  ProposalEvidence,
  ProposalFix,
  ProposalResolution,
  ProposalState,
  ProposalVerdict,
} from '#core/proposal.ts'
import { storedClientKind } from '#core/proposalClient.ts'
import type {
  Proposal,
  ProposalDecisionRef,
  ProposalRelatedFinding,
  ProposalReview,
  ProposalImageAccess,
  ProposalVia,
} from '#core/proposalRecord.ts'

export interface ProposalRow {
  id: number
  vuln_id: string
  scope: string
  image_refs: string | null
  target_key: string
  verdict: string
  justification: string | null
  summary: string
  confidence: string
  presence: string | null
  reachability: string | null
  exposure: string | null
  evidence: string
  fix: string | null
  review: string | null
  unknowns: string
  missing: string
  refs: string
  evidence_basis: string
  image_access: string
  proposed_by: string
  proposed_via: string
  token_id: number | null
  client_label: string
  client_kind: string | null
  agent: string | null
  basis_decisions: string
  state: string
  resolution: string | null
  resolution_note: string | null
  decision_ids: string
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
  related_findings: string
  related_reason: string | null
}

/**
 * Parses a JSON column written by sieb itself.
 * @param {string} text - Column value
 * @returns {T} - Parsed value
 */
const parsed = <T>(text: string): T => JSON.parse(text) as T

/**
 * Parses a nullable JSON column written by sieb itself.
 * @param {string | null} text - Column value
 * @returns {T | null} - Parsed value, null for NULL
 */
const parsedOrNull = <T>(text: string | null): T | null => (text === null ? null : parsed<T>(text))

/**
 * Parses the fix column, a fix stored before the patch action or the availability existed reads
 * as without them.
 * @param {string | null} text - Column value
 * @returns {ProposalFix | null} - Fix, null for NULL
 */
const storedFix = (text: string | null): ProposalFix | null => {
  const fix = parsedOrNull<Partial<ProposalFix>>(text)

  return fix === null
    ? null
    : {
        action: fix.action ?? null,
        layer: fix.layer ?? null,
        fixedVersion: fix.fixedVersion ?? null,
        change: fix.change ?? null,
        effort: fix.effort ?? null,
        availability: fix.availability ?? null,
        waitingFor: fix.waitingFor ?? null,
        interim: fix.interim ?? null,
      }
}

/**
 * Maps a decision_proposals row to the domain type, the CHECK constraints guarantee the literals.
 * @param {ProposalRow} row - Row
 * @returns {Proposal} - Proposal
 */
export const toProposal = (row: ProposalRow): Proposal => ({
  id: row.id,
  vulnId: row.vuln_id,
  scope: row.scope as DecisionScope,
  imageRefs: parsedOrNull<string[]>(row.image_refs),
  verdict: row.verdict as ProposalVerdict,
  justification: row.justification as DecisionJustification | null,
  summary: row.summary,
  confidence: row.confidence as ProposalConfidence,
  presence: row.presence,
  reachability: row.reachability,
  exposure: row.exposure,
  evidence: parsed<ProposalEvidence[]>(row.evidence),
  fix: storedFix(row.fix),
  review: parsedOrNull<ProposalReview>(row.review),
  unknowns: parsed<string[]>(row.unknowns),
  missing: parsed<string[]>(row.missing),
  references: parsed<string[]>(row.refs),
  evidenceBasis: parsed<EvidenceBasis[]>(row.evidence_basis),
  agent: row.agent,
  relatedFindings: parsed<ProposalRelatedFinding[]>(row.related_findings),
  relatedReason: row.related_reason,
  imageAccess: parsed<ProposalImageAccess[]>(row.image_access),
  proposedBy: row.proposed_by,
  proposedVia: row.proposed_via as ProposalVia,
  tokenId: row.token_id,
  clientLabel: row.client_label,
  clientKind: storedClientKind(row.client_kind),
  basisDecisions: parsed<ProposalDecisionRef[]>(row.basis_decisions),
  state: row.state as ProposalState,
  resolution: row.resolution as ProposalResolution | null,
  resolutionNote: row.resolution_note,
  decisionIds: parsed<number[]>(row.decision_ids),
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
  resolvedBy: row.resolved_by,
})
