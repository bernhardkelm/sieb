import { START_LOCATION, type RouteLocationNormalized, type RouteLocationRaw } from 'vue-router'

import { FINDING_QUERY, ROUTE_NAMES } from '@/router/routeNames'

/**
 * Sends a finding link of sieb 0.1.0, which opened the finding panel on the then inbox of
 * undecided findings at `/inbox?finding=<id>`, to the Triage view that list became. Only the
 * first navigation of a page load counts as such a link, so the Inbox itself still opens the
 * finding panel in place.
 * @param {RouteLocationNormalized} to - Target location
 * @param {RouteLocationNormalized} from - Current location, START_LOCATION on page load
 * @returns {RouteLocationRaw | true} - Triage location with the same query, true to proceed
 */
export const legacyFindingLink = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): RouteLocationRaw | true => {
  if (from !== START_LOCATION || to.name !== ROUTE_NAMES.INBOX || !(FINDING_QUERY in to.query)) {
    return true
  }

  return { name: ROUTE_NAMES.TRIAGE, query: to.query, hash: to.hash, replace: true }
}
