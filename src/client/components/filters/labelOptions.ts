import { EXPOSURES, type Exposure } from '#core/exposure.ts'
import { SEVERITIES, type Severity } from '#core/severity.ts'
import type { FilterOption } from '@/components/filters/filterOption'
import { EXPOSURE_LABELS, ownerLabel } from '@/format/labels'

export const SEVERITY_OPTIONS: FilterOption<Severity>[] = SEVERITIES.map((value) => ({
  value,
  label: value,
}))

export const EXPOSURE_OPTIONS: FilterOption<Exposure>[] = EXPOSURES.map((value) => ({
  value,
  label: EXPOSURE_LABELS[value],
}))

/**
 * Builds the owner filter options from the owners present in the data.
 * @param {readonly string[]} owners - Distinct owners, self first
 * @returns {FilterOption<string>[]} - Options in the given order
 */
export const ownerOptions = (owners: readonly string[]): FilterOption<string>[] =>
  owners.map((value) => ({ value, label: ownerLabel(value) }))
