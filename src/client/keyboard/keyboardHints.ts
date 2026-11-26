import { ROUTE_NAMES, type RouteName } from '@/router/routeNames'

export interface KeyboardHint {
  keys: string[]
  label: string
}

const MOVE: KeyboardHint = { keys: ['j', 'k'], label: 'Move' }
const SEARCH: KeyboardHint = { keys: ['/'], label: 'Search' }
const SYNC: KeyboardHint = { keys: ['r'], label: 'Sync' }
const EXPAND: KeyboardHint = { keys: ['Enter'], label: 'Expand, open' }
const COLLAPSE: KeyboardHint = { keys: ['Esc'], label: 'Close, collapse' }

export const KEYBOARD_HINTS: Record<RouteName, KeyboardHint[]> = {
  [ROUTE_NAMES.INBOX]: [
    MOVE,
    { keys: ['Enter'], label: 'Open' },
    { keys: ['Esc'], label: 'Close' },
    { keys: ['a'], label: 'Accept' },
    { keys: ['n'], label: 'Not affected' },
    { keys: ['f'], label: 'Fix planned' },
    { keys: ['x'], label: 'Select' },
    { keys: ['⇧', 'A'], label: 'Bulk decide' },
    SEARCH,
    SYNC,
  ],
  [ROUTE_NAMES.IMAGES]: [MOVE, EXPAND, COLLAPSE, SEARCH, SYNC],
  [ROUTE_NAMES.CVES]: [
    MOVE,
    EXPAND,
    COLLAPSE,
    { keys: ['⇧', 'A'], label: 'Decide open images' },
    { keys: ['⇧', 'D'], label: 'Decide all images' },
    SEARCH,
    SYNC,
  ],
  [ROUTE_NAMES.DECISIONS]: [
    MOVE,
    EXPAND,
    { keys: ['o'], label: 'Open finding' },
    { keys: ['e'], label: 'Edit' },
    { keys: ['⌫'], label: 'Revoke' },
    { keys: ['c'], label: 'Re-confirm' },
    COLLAPSE,
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
