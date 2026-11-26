import { ROUTE_NAMES, type RouteName } from '@/router/routeNames'

export interface NavItem {
  name: RouteName
  label: string
  shortcut: string // single key that navigates to the view
  badge?: 'inbox' // count shown next to the label, the open Inbox items
}

export const NAV_ITEMS: NavItem[] = [
  { name: ROUTE_NAMES.TRIAGE, label: 'Triage', shortcut: '1' },
  { name: ROUTE_NAMES.INBOX, label: 'Inbox', shortcut: '2', badge: 'inbox' },
  { name: ROUTE_NAMES.IMAGES, label: 'By image', shortcut: '3' },
  { name: ROUTE_NAMES.CVES, label: 'By CVE', shortcut: '4' },
  { name: ROUTE_NAMES.DECISIONS, label: 'Decisions', shortcut: '5' },
]
