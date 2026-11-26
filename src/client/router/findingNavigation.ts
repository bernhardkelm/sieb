import type { RouteLocationNormalized } from 'vue-router'

import { readQueryParam } from '@/router/queryParam'
import { FINDING_QUERY } from '@/router/routeNames'

/**
 * Returns whether a navigation moves the side panel to another finding or closes it. A view
 * change that keeps the `finding` param keeps the panel and its decision form mounted.
 * @param {RouteLocationNormalized} to - Target location
 * @param {RouteLocationNormalized} from - Current location
 * @returns {boolean} - True when the panel would show another finding or none
 */
export const leavesFinding = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): boolean => readQueryParam(to.query, FINDING_QUERY) !== readQueryParam(from.query, FINDING_QUERY)
