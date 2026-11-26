export const ROUTE_NAMES = {
  INBOX: 'inbox',
  IMAGES: 'images',
  CVES: 'cves',
  DECISIONS: 'decisions',
} as const

export type RouteName = (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES]

export const FINDING_QUERY = 'finding' // query param that opens the finding side panel on any view
export const IMAGE_QUERY = 'image' // expanded image on the by-image view
export const CVE_QUERY = 'cve' // expanded CVE on the by-CVE view
export const DECISION_QUERY = 'decision' // expanded decision on the decisions view
export const DECISION_TAB_QUERY = 'state' // selected tab on the decisions view
export const SORT_QUERY = 'sort' // sorted column of a list view, absent for the default order
export const SORT_DIRECTION_QUERY = 'dir' // direction of the sorted column, asc or desc
