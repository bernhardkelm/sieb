import type { FindingSource } from '#server/sources/FindingSource.ts'

/**
 * Wraps a finding source so its snapshots carry the KEV list of another provider: the stored
 * CISA catalog, or an empty list when KEV is switched off.
 * @param {FindingSource} source - Source without its own KEV query
 * @param {() => string[] | null} readKevIds - Listed vuln ids, null while unknown
 * @returns {FindingSource} - Source with the provided KEV list
 */
export const withKevList = (
  source: FindingSource,
  readKevIds: () => string[] | null,
): FindingSource => ({
  kind: source.kind,
  fetchSnapshot: async () => ({ ...(await source.fetchSnapshot()), kevIds: readKevIds() }),
})
