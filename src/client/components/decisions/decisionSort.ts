import { DECISION_STATUSES } from '#core/decision.ts'
import type { DecisionState } from '#core/effectiveDecision.ts'
import type { DecisionView } from '#core/findingView.ts'
import { sortItems, type SortColumns, type SortState } from '@/components/list/listSort'
import { imageSortName } from '@/format/imageName'

export type DecisionSortColumn =
  | 'state'
  | 'vulnId'
  | 'scope'
  | 'createdBy'
  | 'createdAt'
  | 'expiresAt'
  | 'openFindings'

/** States in the order they need attention, re-opened first */
const STATE_ORDER: readonly DecisionState[] = [
  'reopened',
  'expired',
  'active',
  'fix_planned',
  'revoked',
]

export const DECISION_SORT_COLUMNS: SortColumns<DecisionView, DecisionSortColumn> = {
  state: {
    label: 'State',
    first: 'asc',
    value: (view) => [
      STATE_ORDER.indexOf(view.effective.state),
      DECISION_STATUSES.indexOf(view.decision.status),
    ],
  },
  vulnId: { label: 'CVE', first: 'asc', value: (view) => view.decision.vulnId },
  scope: {
    label: 'Scope',
    first: 'asc',
    value: (view) => (view.decision.imageRef === null ? '' : imageSortName(view.decision.imageRef)),
  },
  createdBy: { label: 'Decided by', first: 'asc', value: (view) => view.decision.createdBy },
  createdAt: {
    label: 'Decided',
    first: 'desc',
    value: (view) => Date.parse(view.decision.createdAt),
  },
  expiresAt: {
    label: 'Expires',
    first: 'asc',
    value: (view) =>
      view.decision.expiresAt === null ? null : Date.parse(view.decision.expiresAt),
  },
  openFindings: { label: 'Open findings', first: 'desc', value: (view) => view.openFindings },
}

/**
 * Sorts decisions by a column, ties in the order the API returns them, newest first. Scope all
 * sorts before image names, decisions that never expire sort last.
 * @param {readonly DecisionView[]} views - Decisions in API order
 * @param {SortState<DecisionSortColumn> | null} sort - Active sort, null keeps the API order
 * @returns {DecisionView[]} - Sorted copy
 */
export const sortDecisions = (
  views: readonly DecisionView[],
  sort: SortState<DecisionSortColumn> | null,
): DecisionView[] => sortItems(views, DECISION_SORT_COLUMNS, sort)
