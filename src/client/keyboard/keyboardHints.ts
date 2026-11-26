import type { HintActionId } from '@/keyboard/hintActions'
import { MODIFIER_KEY } from '@/keyboard/modifierKey'
import { ROUTE_NAMES, type RouteName } from '@/router/routeNames'

export interface KeyboardHint {
  keys: string[]
  label: string
  /** Action a click on the hint runs, absent for hints shown as text only */
  action?: HintActionId
}

const TREE: KeyboardHint = { keys: ['←', '→'], label: 'Collapse, expand' }
const SEARCH: KeyboardHint = { keys: ['/'], label: 'Search', action: 'search' }
const SYNC: KeyboardHint = { keys: ['r'], label: 'Sync', action: 'sync' }

export const KEYBOARD_HINTS: Record<RouteName, KeyboardHint[]> = {
  [ROUTE_NAMES.INBOX]: [
    { keys: ['a'], label: 'Accept', action: 'accept' },
    { keys: ['n'], label: 'Not affected', action: 'notAffected' },
    { keys: ['f'], label: 'Fix planned', action: 'fixPlanned' },
    { keys: ['x', 'Space'], label: 'Select', action: 'toggle' },
    { keys: ['⇧', '↑', '↓'], label: 'Select range' },
    { keys: [MODIFIER_KEY, 'A'], label: 'Select all', action: 'selectAll' },
    SEARCH,
    SYNC,
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
}

/**
 * Returns the shortcut hints of a view.
 * @param {unknown} routeName - Name of the current route
 * @returns {KeyboardHint[]} - Hints, the inbox ones for unknown routes
 */
export const hintsForRoute = (routeName: unknown): KeyboardHint[] =>
  KEYBOARD_HINTS[routeName as RouteName] ?? KEYBOARD_HINTS[ROUTE_NAMES.INBOX]
