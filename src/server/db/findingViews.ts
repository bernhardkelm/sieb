import type { DatabaseSync } from 'node:sqlite'

import type { Decision } from '#core/decision.ts'
import { decisionCovers } from '#core/decisionApplicability.ts'
import type { DecisionView, FindingDetail, FindingSummary, FindingView } from '#core/findingView.ts'
import { compareInbox, isInInbox } from '#core/inbox.ts'
import { resolveTriage, type Triage } from '#core/triage.ts'
import { listDecisionEvents } from '#server/db/decisionEventRepository.ts'
import { listDecisions, listDecisionsByVuln } from '#server/db/decisionRepository.ts'
import { getFinding, listFindingSummaries } from '#server/db/findingRepository.ts'
import { listInstances } from '#server/db/instanceRepository.ts'
import { getKevDetails } from '#server/db/kevCatalogRepository.ts'

/**
 * Attaches the governing decision and inbox membership to a finding.
 * @param {FindingSummary} summary - Finding with counts
 * @param {Triage} triage - Resolved triage
 * @returns {FindingView} - View
 */
const toFindingView = (summary: FindingSummary, triage: Triage): FindingView => {
  const governing = triage.byFinding.get(summary.id)
  const effective = governing?.effective ?? null

  return {
    ...summary,
    decision: governing?.decision ?? null,
    effective,
    inInbox: isInInbox(summary, effective),
  }
}

/**
 * Builds the view of every decision in a triage.
 * @param {Triage} triage - Resolved triage
 * @param {readonly Decision[]} decisions - Decisions in output order
 * @returns {DecisionView[]} - Views
 */
const toDecisionViews = (triage: Triage, decisions: readonly Decision[]): DecisionView[] =>
  decisions.flatMap((decision) => {
    const entry = triage.byDecision.get(decision.id)

    return entry
      ? [{ decision, effective: entry.effective, openFindings: entry.openFindings.length }]
      : []
  })

/**
 * Lists findings with their governing decision, in inbox order.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Current time
 * @param {{ includeResolved?: boolean }} filter - Resolved findings are included unless false
 * @returns {FindingView[]} - Views sorted by inbox order
 */
export const listFindingViews = (
  db: DatabaseSync,
  now: Date,
  filter: { includeResolved?: boolean } = {},
): FindingView[] => {
  const all = listFindingSummaries(db)
  const triage = resolveTriage(all, listDecisions(db), now)
  const shown =
    filter.includeResolved === false ? all.filter((finding) => finding.resolvedAt === null) : all

  return shown.map((summary) => toFindingView(summary, triage)).sort(compareInbox)
}

/**
 * Lists all decisions with their state, newest first.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Current time
 * @returns {DecisionView[]} - Views
 */
export const listDecisionViews = (db: DatabaseSync, now: Date): DecisionView[] => {
  const decisions = listDecisions(db)

  return toDecisionViews(resolveTriage(listFindingSummaries(db), decisions, now), decisions)
}

/**
 * Lists the decisions of one vulnerability with their state, newest first. Triage only couples
 * findings of one vuln_id, so this equals the matching subset of listDecisionViews.
 * @param {DatabaseSync} db - Open database
 * @param {string} vulnId - Vulnerability id
 * @param {Date} now - Current time
 * @returns {DecisionView[]} - Views
 */
export const listDecisionViewsByVuln = (
  db: DatabaseSync,
  vulnId: string,
  now: Date,
): DecisionView[] => {
  const decisions = listDecisionsByVuln(db, vulnId)

  return toDecisionViews(
    resolveTriage(listFindingSummaries(db, { vulnId }), decisions, now),
    decisions,
  )
}

/**
 * Reads a finding with its instances, every decision covering it, their history and, for a KEV
 * listed finding with catalog details enabled, its CISA catalog entry. Triage only couples
 * findings of one vuln_id, so reading that vuln_id alone gives the full result.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Finding id
 * @param {Date} now - Current time
 * @param {boolean} kevDetails - Whether the stored CISA catalog is the KEV source
 * @returns {FindingDetail | null} - Detail, null for an unknown finding
 */
export const getFindingDetail = (
  db: DatabaseSync,
  id: number,
  now: Date,
  kevDetails = false,
): FindingDetail | null => {
  const finding = getFinding(db, id)

  if (!finding) {
    return null
  }

  const summaries = listFindingSummaries(db, { vulnId: finding.vulnId })
  const summary = summaries.find((candidate) => candidate.id === id)

  if (!summary) {
    return null
  }

  const vulnDecisions = listDecisionsByVuln(db, finding.vulnId)
  const decisions = vulnDecisions.filter((decision) => decisionCovers(decision, finding))
  const triage = resolveTriage(summaries, vulnDecisions, now)

  return {
    finding: toFindingView(summary, triage),
    instances: listInstances(db, id),
    decisions: toDecisionViews(triage, decisions),
    events: listDecisionEvents(
      db,
      decisions.map((decision) => decision.id),
    ),
    kev: kevDetails && summary.kev ? getKevDetails(db, finding.vulnId) : null,
  }
}
