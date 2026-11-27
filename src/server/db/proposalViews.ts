import type { DatabaseSync } from 'node:sqlite'

import type {
  ProposalDetail,
  ProposalImageFacts,
  ProposalListItem,
} from '#core/proposalApiTypes.ts'
import type { AccessScope } from '#core/accessScope.ts'
import type { Finding } from '#core/finding.ts'
import type { DecisionView, FindingView } from '#core/findingView.ts'
import { imageCheckAccessOf } from '#core/imageCheckAccess.ts'
import { proposalDecisionValues } from '#core/proposalAccept.ts'
import { currentDecisionRefs, isProposalOutdated } from '#core/proposalFreshness.ts'
import type { Proposal } from '#core/proposalRecord.ts'
import { toProposalView } from '#core/proposalView.ts'
import { maxSeverity } from '#core/severity.ts'
import { sourceAccess } from '#core/sourceAccess.ts'
import { listDecisionsByVuln } from '#server/db/decisionRepository.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { listCurrentVersions } from '#server/db/findingVersions.ts'
import { listDecisionViewsByVuln, listFindingViews } from '#server/db/findingViews.ts'
import { getKevDetails } from '#server/db/kevCatalogRepository.ts'
import {
  getProposal,
  listProposals,
  type ProposalListFilter,
} from '#server/db/proposalRepository.ts'
import { relatedFindingFacts } from '#server/db/relatedFindingFacts.ts'

export interface ProposalViewContext {
  now: Date
  publicRegistries: readonly string[]
  kevDetails: boolean // whether the stored CISA catalog is the KEV source
  scopes?: readonly AccessScope[] // usable credentials, empty while private access is off
}

/**
 * Returns the findings a proposal is about: its target images, or for scope all the images with
 * an open finding, falling back to every finding of the target once none is open.
 * @param {Proposal} proposal - Proposal
 * @param {readonly T[]} findings - Findings of its vulnerability
 * @returns {T[]} - Target findings
 */
const targetFindings = <T extends Finding>(proposal: Proposal, findings: readonly T[]): T[] => {
  const images = proposal.imageRefs === null ? null : new Set(proposal.imageRefs)
  const targets = findings.filter((finding) => images === null || images.has(finding.imageRef))
  const open = targets.filter((finding) => finding.resolvedAt === null)

  return open.length > 0 ? open : targets
}

/**
 * Builds the list entry of a proposal.
 * @param {DatabaseSync} db - Open database
 * @param {Proposal} proposal - Proposal
 * @returns {ProposalListItem} - Entry with freshness, severity, KEV and image count
 */
const toListItem = (db: DatabaseSync, proposal: Proposal): ProposalListItem => {
  const targets = targetFindings(proposal, listFindingsByVuln(db, proposal.vulnId))
  const current = currentDecisionRefs(proposal, listDecisionsByVuln(db, proposal.vulnId))

  return {
    proposal: toProposalView(proposal),
    outdated: proposal.state === 'open' && isProposalOutdated(proposal.basisDecisions, current),
    severity: maxSeverity(targets.map((finding) => finding.severity)),
    kev: targets.some((finding) => finding.kev),
    imageCount: proposal.imageRefs?.length ?? targets.length,
  }
}

/**
 * Lists proposals with their freshness and target facts.
 * @param {DatabaseSync} db - Open database
 * @param {ProposalListFilter} filter - State, vulnerability and proposer
 * @returns {ProposalListItem[]} - Entries, newest first
 */
export const listProposalItems = (
  db: DatabaseSync,
  filter: ProposalListFilter,
): ProposalListItem[] => listProposals(db, filter).map((proposal) => toListItem(db, proposal))

/**
 * Builds sieb's facts on one image of a proposal.
 * @param {string} imageRef - Image
 * @param {FindingView | undefined} finding - Finding of the vulnerability in it
 * @param {readonly DecisionView[]} decisions - Decision views of the vulnerability
 * @param {ProposalViewContext & { versions: Map<number, ProposalImageFacts['versions']> }} context - Registries, credentials and versions
 * @returns {ProposalImageFacts} - Facts
 */
const toImageFacts = (
  imageRef: string,
  finding: FindingView | undefined,
  decisions: readonly DecisionView[],
  context: ProposalViewContext & { versions: Map<number, ProposalImageFacts['versions']> },
): ProposalImageFacts => ({
  imageRef,
  findingId: finding?.id ?? null,
  open: finding !== undefined && finding.resolvedAt === null,
  severity: finding?.severity ?? null,
  score: finding?.score ?? null,
  kev: finding?.kev ?? false,
  exposure: finding?.exposure ?? null,
  owner: finding?.owner ?? null,
  sourceAccess: sourceAccess(imageRef, finding?.owner ?? null, context.publicRegistries),
  checkAccess: imageCheckAccessOf(
    { imageRef, owner: finding?.owner ?? null },
    context.publicRegistries,
    context.scopes ?? [],
  ),
  versions: finding ? (context.versions.get(finding.id) ?? []) : [],
  workloads: finding?.workloads ?? [],
  decision: decisions.find((view) => view.decision.id === finding?.decision?.id) ?? null,
})

/**
 * Reads a proposal with sieb's own facts per image, the current decisions, what accepting it
 * without edits writes, the CISA catalog entry and the facts on its related findings, for the
 * review panel.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Proposal id
 * @param {ProposalViewContext} context - Time, public registries, KEV source and usable credentials
 * @returns {ProposalDetail | null} - Detail, null for an unknown proposal
 */
export const getProposalDetail = (
  db: DatabaseSync,
  id: number,
  context: ProposalViewContext,
): ProposalDetail | null => {
  const proposal = getProposal(db, id)

  if (!proposal) {
    return null
  }

  const all = listFindingViews(db, context.now)
  const findings = all.filter((finding) => finding.vulnId === proposal.vulnId)
  const relatedIds = new Set(proposal.relatedFindings.map((entry) => entry.findingId))
  const related = all.filter((finding) => relatedIds.has(finding.id))
  const decisions = listDecisionViewsByVuln(db, proposal.vulnId, context.now)
  const images = proposal.imageRefs ?? targetFindings(proposal, findings).map((f) => f.imageRef)
  const byImage = new Map(findings.map((finding) => [finding.imageRef, finding]))
  const versions = listCurrentVersions(
    db,
    [...findings, ...related].map((finding) => finding.id),
  )
  const current = currentDecisionRefs(
    proposal,
    decisions.map((view) => view.decision),
  )

  return {
    ...toListItem(db, proposal),
    images: [...images]
      .sort()
      .map((imageRef) =>
        toImageFacts(imageRef, byImage.get(imageRef), decisions, { ...context, versions }),
      ),
    allScopeDecision:
      decisions.find((view) => view.decision.scope === 'all' && view.decision.revokedAt === null) ??
      null,
    currentDecisionIds: current,
    decisionValues: proposalDecisionValues(proposal, context.now),
    kevCatalog: context.kevDetails ? getKevDetails(db, proposal.vulnId) : null,
    related: relatedFindingFacts(proposal.relatedFindings, {
      findings: new Map(related.map((finding) => [finding.id, finding])),
      versions,
      publicRegistries: context.publicRegistries,
    }),
  }
}
