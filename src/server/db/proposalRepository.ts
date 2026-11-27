import type { DatabaseSync, SQLInputValue } from 'node:sqlite'

import {
  proposalTargetKey,
  type Proposal,
  type ProposalResolution,
  type ProposalState,
} from '#core/proposal.ts'
import { toProposal, type ProposalRow } from '#server/db/proposalRows.ts'

/** Proposal as filed, before it has an id or a resolution */
export type NewProposal = Omit<
  Proposal,
  'id' | 'state' | 'resolution' | 'resolutionNote' | 'decisionIds' | 'resolvedAt' | 'resolvedBy'
>

export interface ProposalListFilter {
  state?: ProposalState // absent lists every state
  vulnId?: string
  proposedBy?: string
  checkId?: number | null // proposals of one Auto-check, null for those of no check
}

export interface ProposalResolutionWrite {
  state: Exclude<ProposalState, 'open'>
  resolution: ProposalResolution
  note: string | null
  decisionIds: number[]
  at: string
  by: string
}

/**
 * Stringifies a nullable JSON column value.
 * @param {unknown} value - Value
 * @returns {string | null} - JSON, null for null
 */
const jsonOrNull = (value: unknown): string | null =>
  value === null ? null : JSON.stringify(value)

/**
 * Reads one proposal.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Proposal id
 * @returns {Proposal | null} - Proposal, null when unknown
 */
export const getProposal = (db: DatabaseSync, id: number): Proposal | null => {
  const row = db.prepare('SELECT * FROM decision_proposals WHERE id = ?').get(id) as
    | ProposalRow
    | undefined

  return row ? toProposal(row) : null
}

/**
 * Lists proposals matching a filter.
 * @param {DatabaseSync} db - Open database
 * @param {ProposalListFilter} filter - State, vulnerability, proposer and check, each optional
 * @returns {Proposal[]} - Proposals, newest first
 */
export const listProposals = (db: DatabaseSync, filter: ProposalListFilter = {}): Proposal[] => {
  const conditions: string[] = []
  const values: SQLInputValue[] = []
  const columns = {
    state: 'state',
    vulnId: 'vuln_id',
    proposedBy: 'proposed_by',
    checkId: 'check_id',
  } as const

  for (const [key, column] of Object.entries(columns)) {
    const value = filter[key as keyof ProposalListFilter]

    if (value === null) {
      conditions.push(`${column} IS NULL`)
    } else if (value !== undefined) {
      conditions.push(`${column} = ?`)
      values.push(value)
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db
    .prepare(`SELECT * FROM decision_proposals ${where} ORDER BY id DESC`)
    .all(...values) as unknown as ProposalRow[]

  return rows.map(toProposal)
}

/**
 * Counts the open proposals a user filed through their own tokens and connectors; proposals of
 * their Auto-checks do not count.
 * @param {DatabaseSync} db - Open database
 * @param {string} proposedBy - Proposing user
 * @returns {number} - Open proposals
 */
export const countOpenProposals = (db: DatabaseSync, proposedBy: string): number =>
  Number(
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM decision_proposals
         WHERE proposed_by = ? AND state = 'open' AND check_id IS NULL`,
      )
      .get(proposedBy)?.n ?? 0,
  )

/**
 * Stores a new open proposal.
 * @param {DatabaseSync} db - Open database
 * @param {NewProposal} proposal - Validated proposal with proposer, snapshots and time
 * @param {number | null} checkId - Auto-check whose token filed it, else null
 * @returns {number} - Proposal id
 */
export const insertProposal = (
  db: DatabaseSync,
  proposal: NewProposal,
  checkId: number | null = null,
): number => {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO decision_proposals (vuln_id, scope, image_refs, target_key, verdict,
         justification, summary, confidence, presence, reachability, exposure, evidence, fix,
         review, unknowns, missing, refs, evidence_basis, source_access, proposed_by,
         proposed_via, token_id, client_label, client_kind, agent, basis_decisions, created_at,
         check_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      proposal.vulnId,
      proposal.scope,
      jsonOrNull(proposal.imageRefs),
      proposalTargetKey(proposal),
      proposal.verdict,
      proposal.justification,
      proposal.summary,
      proposal.confidence,
      proposal.presence,
      proposal.reachability,
      proposal.exposure,
      JSON.stringify(proposal.evidence),
      jsonOrNull(proposal.fix),
      jsonOrNull(proposal.review),
      JSON.stringify(proposal.unknowns),
      JSON.stringify(proposal.missing),
      JSON.stringify(proposal.references),
      JSON.stringify(proposal.evidenceBasis),
      JSON.stringify(proposal.sourceAccess),
      proposal.proposedBy,
      proposal.proposedVia,
      proposal.tokenId,
      proposal.clientLabel,
      proposal.clientKind,
      proposal.agent,
      JSON.stringify(proposal.basisDecisions),
      proposal.createdAt,
      checkId,
    )

  return Number(lastInsertRowid)
}

/**
 * Closes an open proposal. A proposal that is no longer open stays as it is.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Proposal id
 * @param {ProposalResolutionWrite} write - New state, resolution, note, decisions, time and actor
 * @returns {boolean} - True when the proposal was open and is now closed
 */
export const resolveProposal = (
  db: DatabaseSync,
  id: number,
  write: ProposalResolutionWrite,
): boolean =>
  db
    .prepare(
      `UPDATE decision_proposals SET state = ?, resolution = ?, resolution_note = ?,
         decision_ids = ?, resolved_at = ?, resolved_by = ?
       WHERE id = ? AND state = 'open'`,
    )
    .run(
      write.state,
      write.resolution,
      write.note,
      JSON.stringify(write.decisionIds),
      write.at,
      write.by,
      id,
    ).changes > 0
