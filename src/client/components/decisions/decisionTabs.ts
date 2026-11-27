import {
  isDecisionFilter,
  matchesDecisionFilter,
  type DecisionFilter,
} from '#core/decisionFilter.ts'
import type { DecisionView } from '#core/findingView.ts'

export interface DecisionTab {
  value: DecisionFilter
  label: string
}

export const DECISION_TABS: DecisionTab[] = [
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'reopened', label: 'Re-opened' },
  { value: 'expired', label: 'Expired' },
  { value: 'fix_planned', label: 'Fix planned' },
  { value: 'upstream_pending', label: 'Waiting for upstream' },
  { value: 'revoked', label: 'Revoked' },
]

export const DEFAULT_DECISION_TAB: DecisionFilter = 'active'

type TabDecision = Pick<DecisionView, 'decision' | 'effective'>

/**
 * Reads the tab from its query param.
 * @param {string | null} value - Query param value
 * @returns {DecisionFilter} - Tab, active for missing or unknown values
 */
export const parseDecisionTab = (value: string | null): DecisionFilter =>
  isDecisionFilter(value) ? value : DEFAULT_DECISION_TAB

/**
 * Counts the decisions of every tab; expiring decisions count under active too, those waiting
 * for upstream under their state.
 * @param {readonly TabDecision[]} views - Decisions with their state
 * @param {Date} now - Current time, anchors expiring
 * @returns {Record<DecisionFilter, number>} - Count per tab
 */
export const countDecisionTabs = (
  views: readonly TabDecision[],
  now: Date,
): Record<DecisionFilter, number> =>
  Object.fromEntries(
    DECISION_TABS.map(({ value }) => [
      value,
      views.filter((view) => matchesDecisionFilter(view, value, now)).length,
    ]),
  ) as Record<DecisionFilter, number>

/**
 * Returns the decisions of a tab, keeping their order.
 * @param {readonly T[]} views - Decisions with their state, newest first
 * @param {DecisionFilter} tab - Tab
 * @param {Date} now - Current time, anchors expiring
 * @returns {T[]} - Decisions of the tab
 */
export const decisionsInTab = <T extends TabDecision>(
  views: readonly T[],
  tab: DecisionFilter,
  now: Date,
): T[] => views.filter((view) => matchesDecisionFilter(view, tab, now))

export const DECISION_TAB_EMPTY: Record<DecisionFilter, { title: string; text: string }> = {
  active: {
    title: 'No active decisions',
    text: 'Not affected and accepted decisions in effect show up here.',
  },
  expiring: {
    title: 'Nothing expires soon',
    text: 'Active decisions expiring within 14 days show up here.',
  },
  reopened: {
    title: 'Nothing re-opened',
    text: 'Decisions whose findings rose in severity or got KEV listed show up here.',
  },
  expired: { title: 'No expired decisions', text: 'Decisions past their expiry show up here.' },
  fix_planned: { title: 'No planned fixes', text: 'Fix planned decisions show up here.' },
  upstream_pending: {
    title: 'Nothing waits for upstream',
    text: 'Fix planned decisions waiting for an upstream release show up here.',
  },
  revoked: { title: 'Nothing revoked', text: 'Revoked decisions show up here.' },
}

/**
 * Returns the empty state of a tab, without mentioning KEV when no KEV source is configured.
 * @param {DecisionFilter} tab - Active tab
 * @param {boolean} kev - Whether a KEV source is configured
 * @returns {{ title: string; text: string }} - Empty state
 */
export const decisionTabEmpty = (
  tab: DecisionFilter,
  kev: boolean,
): { title: string; text: string } =>
  tab === 'reopened' && !kev
    ? {
        ...DECISION_TAB_EMPTY.reopened,
        text: 'Decisions whose findings rose in severity show up here.',
      }
    : DECISION_TAB_EMPTY[tab]
