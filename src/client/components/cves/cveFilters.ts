import type { CveAggregate } from '#core/cveAggregation.ts'
import {
  containsSearch,
  passesSelection,
  type AggregateFilters,
} from '@/components/filters/aggregateFilters'

/**
 * Filters CVEs by search text over vuln_id, title and image_refs, highest severity and highest
 * exposure, keeping their order.
 * @param {readonly CveAggregate[]} cves - CVEs in inbox order
 * @param {AggregateFilters} filters - Filter state, owner is ignored
 * @returns {CveAggregate[]} - Matching CVEs
 */
export const filterCves = (
  cves: readonly CveAggregate[],
  filters: AggregateFilters,
): CveAggregate[] =>
  cves.filter(
    (cve) =>
      passesSelection(filters.severity, cve.maxSeverity) &&
      passesSelection(filters.exposure, cve.maxExposure) &&
      containsSearch([cve.vulnId, cve.title ?? '', ...cve.imageRefs], filters.q),
  )
