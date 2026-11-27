import type { HintActionId } from '@/keyboard/hintActions'
import { MODIFIER_KEY } from '@/keyboard/modifierKey'
import { ROUTE_NAMES, type RouteName } from '@/router/routeNames'

export interface KeyboardHint {
  keys: string[]
  label: string
  /** Label with `{n}` where the count of checked items goes, the count follows the label when absent */
  template?: string
  /** Action a click on the hint runs, absent for hints shown as text only */
  action?: HintActionId
  /** Shown only with the Claude integration switched on */
  mcp?: boolean
  /** Shown only with Auto-check switched on */
  checks?: boolean
}

const TREE: KeyboardHint = { keys: ['←', '→'], label: 'Collapse, expand' }
const SEARCH: KeyboardHint = { keys: ['/'], label: 'Search', action: 'search' }
const SYNC: KeyboardHint = { keys: ['r'], label: 'Sync', action: 'sync' }

const INBOX: KeyboardHint[] = [
  { keys: ['a'], label: 'Accept', action: 'accept' },
  { keys: ['d'], label: 'Reject', action: 'reject' },
  { keys: ['s'], label: 'Mark as seen', action: 'markSeen' },
  { keys: ['x', 'Space'], label: 'Select', action: 'toggle' },
  { keys: ['⇧', '↑', '↓'], label: 'Select range' },
  { keys: [MODIFIER_KEY, 'A'], label: 'Select all', action: 'selectAll' },
  SYNC,
]

export const KEYBOARD_HINTS: Record<RouteName, KeyboardHint[]> = {
  [ROUTE_NAMES.INBOX]: INBOX,
  [ROUTE_NAMES.INBOX_PROPOSAL]: [
    { keys: [MODIFIER_KEY, 'Enter'], label: 'Accept' },
    { keys: ['Esc'], label: 'Close' },
    SYNC,
  ],
  [ROUTE_NAMES.TRIAGE]: [
    { keys: ['a'], label: 'Accept', action: 'accept' },
    { keys: ['n'], label: 'Not affected', action: 'notAffected' },
    { keys: ['f'], label: 'Fix planned', action: 'fixPlanned' },
    { keys: ['x', 'Space'], label: 'Select', action: 'toggle' },
    { keys: ['⇧', '↑', '↓'], label: 'Select range' },
    { keys: [MODIFIER_KEY, 'A'], label: 'Select all', action: 'selectAll' },
    SEARCH,
    SYNC,
    {
      keys: ['⇧', 'H'],
      label: 'Open in Claude',
      template: 'Open {n} in Claude',
      action: 'handoffOpen',
      mcp: true,
    },
    {
      keys: ['h'],
      label: 'Copy for Claude',
      template: 'Copy {n} for Claude',
      action: 'handoff',
      mcp: true,
    },
    {
      keys: ['y'],
      label: 'Copy claude command',
      template: 'Copy claude command for {n}',
      action: 'handoffCommand',
      mcp: true,
    },
    { keys: ['⇧', 'C'], label: 'Auto-check', action: 'autoCheck', mcp: true, checks: true },
  ],
  [ROUTE_NAMES.IMAGES]: [TREE, SEARCH, SYNC],
  [ROUTE_NAMES.CVES]: [
    TREE,
    { keys: ['⇧', 'A'], label: 'Decide open images', action: 'decideOpen' },
    { keys: ['⇧', 'D'], label: 'Decide all images', action: 'decideAll' },
    SEARCH,
    SYNC,
  ],
  [ROUTE_NAMES.DECISIONS]: [
    TREE,
    { keys: ['o'], label: 'Open finding', action: 'openFinding' },
    { keys: ['e'], label: 'Edit', action: 'edit' },
    { keys: ['⌫'], label: 'Revoke', action: 'revoke' },
    { keys: ['c'], label: 'Re-confirm', action: 'reconfirm' },
    SEARCH,
    SYNC,
  ],
  [ROUTE_NAMES.CHECKS]: [SYNC],
}

/**
 * Returns the shortcut hints of a view.
 * @param {unknown} routeName - Name of the current route
 * @param {boolean} mcpEnabled - Whether the Claude integration is on, its hints are left out otherwise
 * @param {boolean} checksEnabled - Whether Auto-check is on, its hint is left out otherwise
 * @returns {KeyboardHint[]} - Hints, the Inbox ones for unknown routes
 */
export const hintsForRoute = (
  routeName: unknown,
  mcpEnabled = false,
  checksEnabled = false,
): KeyboardHint[] =>
  (KEYBOARD_HINTS[routeName as RouteName] ?? KEYBOARD_HINTS[ROUTE_NAMES.INBOX]).filter(
    (hint) => (mcpEnabled || !hint.mcp) && (checksEnabled || !hint.checks),
  )
