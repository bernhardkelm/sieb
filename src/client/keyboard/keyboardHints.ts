import { DECISION_KEYMAP } from '@/keyboard/decisionKeymap'
import { AUTO_CHECK_HINT_KEYS, HANDOFF_KEYMAP } from '@/keyboard/handoffKeymap'
import type { HintActionId } from '@/keyboard/hintActions'
import { MODIFIER_KEY } from '@/keyboard/modifierKey'
import { isAvailable, NO_FEATURES, type Feature, type Features } from '@/router/featureGate'
import { ROUTE_NAMES, type RouteName } from '@/router/routeNames'

export interface KeyboardHint {
  keys: string[]
  label: string
  /** Label with `{n}` where the count of checked items goes, the count follows the label when absent */
  template?: string
  /** Action a click on the hint runs, absent for hints shown as text only */
  action?: HintActionId
  /** Shown only while these features are switched on */
  requires?: readonly Feature[]
}

const CLAUDE: readonly Feature[] = ['mcp']
const AUTO_CHECK: readonly Feature[] = ['mcp', 'checks']

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
  SEARCH,
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
    ...DECISION_KEYMAP.map(({ key, label, action }) => ({ keys: [key], label, action })),
    { keys: ['x', 'Space'], label: 'Select', action: 'toggle' },
    { keys: ['⇧', '↑', '↓'], label: 'Select range' },
    { keys: [MODIFIER_KEY, 'A'], label: 'Select all', action: 'selectAll' },
    SEARCH,
    SYNC,
    ...HANDOFF_KEYMAP.map(({ hintKeys, label, template, hintId }) => ({
      keys: hintKeys,
      label,
      template,
      action: hintId,
      requires: CLAUDE,
    })),
    { keys: AUTO_CHECK_HINT_KEYS, label: 'Auto-check', action: 'autoCheck', requires: AUTO_CHECK },
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
  [ROUTE_NAMES.ACCESS]: [SYNC],
}

/**
 * Returns the shortcut hints of a view.
 * @param {unknown} routeName - Name of the current route
 * @param {Features} features - Switched on features, hints of the others are left out
 * @returns {KeyboardHint[]} - Hints, the Inbox ones for unknown routes
 */
export const hintsForRoute = (
  routeName: unknown,
  features: Features = NO_FEATURES,
): KeyboardHint[] =>
  (KEYBOARD_HINTS[routeName as RouteName] ?? KEYBOARD_HINTS[ROUTE_NAMES.INBOX]).filter((hint) =>
    isAvailable(hint, features),
  )
