import { isFullyDecided, type CveAggregate } from '#core/cveAggregation.ts'
import {
  containsSearch,
  passesSelection,
  type AggregateFilters,
} from '@/components/filters/aggregateFilters'

/**
 * Filters CVEs by search text over vuln_id, title and image_refs, highest severity and highest
 * exposure, keeping their order. Without showDecided, CVEs whose open findings are all decided
 * drop out.
 * @param {readonly CveAggregate[]} cves - CVEs in inbox order
 * @param {AggregateFilters} filters - Filter state, owner and showNotAffected are ignored
 * @returns {CveAggregate[]} - Matching CVEs
 */
export const filterCves = (
  cves: readonly CveAggregate[],
  filters: AggregateFilters,
): CveAggregate[] =>
  cves.filter(
    (cve) =>
      (filters.showDecided || !isFullyDecided(cve)) &&
      passesSelection(filters.severity, cve.maxSeverity) &&
      passesSelection(filters.exposure, cve.maxExposure) &&
      containsSearch([cve.vulnId, cve.title ?? '', ...cve.imageRefs], filters.q),
  )

/**
 * Counts the CVEs the decided toggle hides: fully decided ones passing the other filters.
 * @param {readonly CveAggregate[]} cves - CVEs
 * @param {AggregateFilters} filters - Filter state
 * @returns {number} - Hidden CVEs, 0 while the toggle is on
 */
export const countHiddenCves = (cves: readonly CveAggregate[], filters: AggregateFilters): number =>
  filters.showDecided
    ? 0
    : filterCves(cves.filter(isFullyDecided), { ...filters, showDecided: true }).length
