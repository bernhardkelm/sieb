import type { SourceSnapshot } from '#core/sourceSnapshot.ts'
import { joinFindings } from '#server/sources/mapping/joinFindings.ts'
import {
  parseFindingInfo,
  parseKevListed,
  type InfoSeries,
} from '#server/sources/mapping/prometheusVector.ts'
import {
  parseVulnerabilityReports,
  type ReportVulnerability,
} from '#server/sources/mapping/vulnerabilityReports.ts'
import type { SourceQueries } from '#server/sources/sourceQueries.ts'

/** Raw responses of the source requests, already JSON parsed */
export interface RawSourceData {
  vulnerabilityReports: unknown
  findingInfo: unknown
  kevListed?: unknown // left out when the KEV query is not requested
}

export interface ParsedSource {
  info: InfoSeries[]
  vulnerabilities: ReportVulnerability[]
  kevIds: string[] | null // null without a KEV query
}

/**
 * Parses the raw source responses.
 * @param {RawSourceData} raw - Parsed JSON responses
 * @param {SourceQueries} queries - Queries the responses answer, for error messages
 * @returns {ParsedSource} - Mapped series, vulnerabilities and KEV ids
 * @throws {Error} - When a response has the wrong shape
 */
export const parseSourceData = (raw: RawSourceData, queries: SourceQueries): ParsedSource => ({
  info: parseFindingInfo(raw.findingInfo, queries.findings),
  vulnerabilities: parseVulnerabilityReports(raw.vulnerabilityReports),
  kevIds: queries.kev === null ? null : parseKevListed(raw.kevListed, queries.kev),
})

/**
 * Joins parsed source data into a snapshot. An empty info result next to reports with
 * vulnerabilities means the recording rule is missing or Prometheus lost its data, so it fails
 * instead of resolving every finding. An empty result of a KEV query means a broken feed, the
 * CISA catalog holds well over a thousand entries, so it fails instead of reporting every
 * finding as not KEV listed.
 * @param {ParsedSource} parsed - Parsed source data
 * @param {string} fetchedAt - ISO time of the fetch
 * @param {SourceQueries} queries - Queries of the parsed data, for error messages
 * @returns {SourceSnapshot} - Snapshot
 * @throws {Error} - For an empty info result while reports list vulnerabilities, or no KEV entry
 */
export const buildSnapshot = (
  parsed: ParsedSource,
  fetchedAt: string,
  queries: SourceQueries,
): SourceSnapshot => {
  if (queries.kev !== null && parsed.kevIds?.length === 0) {
    throw new Error(`${queries.kev} is empty, the KEV feed is broken`)
  }

  if (parsed.info.length === 0 && parsed.vulnerabilities.length > 0) {
    throw new Error(
      `${queries.findings} is empty while reports list ${parsed.vulnerabilities.length} vulnerabilities`,
    )
  }

  return {
    instances: joinFindings(parsed.info, parsed.vulnerabilities),
    kevIds: parsed.kevIds,
    fetchedAt,
  }
}
