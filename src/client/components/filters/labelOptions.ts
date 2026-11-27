import { EXPOSURE_FILTERS, type ExposureFilter } from '#core/exposure.ts'
import { PENDING_FILTERS, type PendingFilter } from '#core/findingPending.ts'
import { SEVERITIES, type Severity } from '#core/severity.ts'
import type { FilterOption } from '@/components/filters/filterOption'
import { EXPOSURE_FILTER_LABELS, ownerLabel, PENDING_FILTER_LABELS } from '@/format/labels'

export const SEVERITY_OPTIONS: FilterOption<Severity>[] = SEVERITIES.map((value) => ({
  value,
  label: value,
}))

export const EXPOSURE_OPTIONS: FilterOption<ExposureFilter>[] = EXPOSURE_FILTERS.map((value) => ({
  value,
  label: EXPOSURE_FILTER_LABELS[value],
}))

/**
 * Builds the owner filter options from the owners present in the data.
 * @param {readonly string[]} owners - Distinct owners, self first
 * @returns {FilterOption<string>[]} - Options in the given order
 */
export const ownerOptions = (owners: readonly string[]): FilterOption<string>[] =>
  owners.map((value) => ({ value, label: ownerLabel(value) }))

/**
 * Builds the pending filter options, checking only while Auto-check is on.
 * @param {boolean} checksEnabled - Whether Auto-check is on
 * @returns {FilterOption<PendingFilter>[]} - Options in filter order
 */
export const pendingOptions = (checksEnabled: boolean): FilterOption<PendingFilter>[] =>
  PENDING_FILTERS.filter((value) => checksEnabled || value !== 'checking').map((value) => ({
    value,
    label: PENDING_FILTER_LABELS[value],
  }))
