import { findingKey } from '#core/instanceKey.ts'
import type { FindingKey } from '#core/finding.ts'
import type { ParsedSource } from '#server/sources/mapping/buildSnapshot.ts'
import { joinKey } from '#server/sources/mapping/joinFindings.ts'

/**
 * Applies the "next" fixture state to the base state: drops every row of the resolved
 * findings, lets next info series replace base series with the same join key (a severity
 * change), appends the next report vulnerabilities and merges the KEV lists.
 * @param {ParsedSource} base - Parsed base fixtures
 * @param {ParsedSource} next - Parsed next fixtures
 * @param {readonly FindingKey[]} resolved - Findings absent in the next state
 * @returns {ParsedSource} - Next state
 */
export const applyNextTick = (
  base: ParsedSource,
  next: ParsedSource,
  resolved: readonly FindingKey[],
): ParsedSource => {
  const removed = new Set(resolved.map((key) => findingKey(key.vulnId, key.imageRef)))
  const replaced = new Set(next.info.map(joinKey))
  /**
   * Returns whether a row belongs to a finding that stays.
   * @param {T} row - Row with a finding key
   * @returns {boolean} - False for rows of resolved findings
   */
  const kept = <T extends FindingKey>(row: T): boolean =>
    !removed.has(findingKey(row.vulnId, row.imageRef))

  return {
    info: [
      ...base.info.filter((series) => kept(series) && !replaced.has(joinKey(series))),
      ...next.info,
    ],
    vulnerabilities: [...base.vulnerabilities.filter(kept), ...next.vulnerabilities],
    kevIds: [...new Set([...(base.kevIds ?? []), ...(next.kevIds ?? [])])],
  }
}
