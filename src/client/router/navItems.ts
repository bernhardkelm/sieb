import { isAvailable, type Feature, type Features } from '@/router/featureGate'
import { ROUTE_NAMES, type RouteName } from '@/router/routeNames'

export type NavIcon = 'triage' | 'inbox' | 'images' | 'cves' | 'decisions' | 'checks'

export interface NavItem {
  name: RouteName
  label: string
  shortLabel?: string // label of the narrow bottom navigation, the full label stays the accessible name
  icon: NavIcon // shown above the label in the bottom navigation
  shortcut: string // single key that navigates to the view
  badge?: 'inbox' | 'checks' // count shown next to the label, open Inbox items or open checks
  requires?: readonly Feature[] // listed only while these features are switched on
}

export const NAV_ITEMS: NavItem[] = [
  { name: ROUTE_NAMES.TRIAGE, label: 'Triage', icon: 'triage', shortcut: '1' },
  { name: ROUTE_NAMES.INBOX, label: 'Inbox', icon: 'inbox', shortcut: '2', badge: 'inbox' },
  {
    name: ROUTE_NAMES.IMAGES,
    label: 'By image',
    shortLabel: 'Images',
    icon: 'images',
    shortcut: '3',
  },
  { name: ROUTE_NAMES.CVES, label: 'By CVE', shortLabel: 'CVEs', icon: 'cves', shortcut: '4' },
  { name: ROUTE_NAMES.DECISIONS, label: 'Decisions', icon: 'decisions', shortcut: '5' },
  {
    name: ROUTE_NAMES.CHECKS,
    label: 'Checks',
    icon: 'checks',
    shortcut: '6',
    badge: 'checks',
    requires: ['checks'],
  },
]

/**
 * Returns the views the sidebar lists and their keys reach.
 * @param {Features} features - Switched on features
 * @returns {NavItem[]} - Nav items, the Checks view only with Auto-check on
 */
export const navItemsFor = (features: Features): NavItem[] =>
  NAV_ITEMS.filter((item) => isAvailable(item, features))
