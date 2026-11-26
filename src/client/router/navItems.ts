import { ROUTE_NAMES, type RouteName } from '@/router/routeNames'

export interface NavItem {
  name: RouteName
  label: string
  shortcut: string // single key that navigates to the view
}

export const NAV_ITEMS: NavItem[] = [
  { name: ROUTE_NAMES.INBOX, label: 'Inbox', shortcut: '1' },
  { name: ROUTE_NAMES.IMAGES, label: 'By image', shortcut: '2' },
  { name: ROUTE_NAMES.CVES, label: 'By CVE', shortcut: '3' },
  { name: ROUTE_NAMES.DECISIONS, label: 'Decisions', shortcut: '4' },
]
