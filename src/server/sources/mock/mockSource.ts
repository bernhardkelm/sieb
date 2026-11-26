import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Clock } from '#core/clock.ts'
import type { FindingKey } from '#core/finding.ts'
import type { FindingSource } from '#server/sources/FindingSource.ts'
import {
  buildSnapshot,
  parseSourceData,
  type ParsedSource,
} from '#server/sources/mapping/buildSnapshot.ts'
import { parseKevFeed } from '#server/kev/parseKevFeed.ts'
import { applyNextTick } from '#server/sources/mock/applyNextTick.ts'
import { DEFAULT_SOURCE_QUERIES, type SourceQueries } from '#server/sources/sourceQueries.ts'

export const MOCK_FIXTURES_DIR = fileURLToPath(new URL('fixtures', import.meta.url))

export const FIXTURE_FILES = {
  vulnerabilityReports: 'vulnerabilityReports.json',
  findingInfo: 'findingInfo.json',
  kevCatalog: 'kevCatalog.json',
  resolved: 'resolved.json',
} as const

export interface MockSourceOptions {
  clock: Clock
  fixturesDir?: string
}

/** The fixture KEV list comes from the catalog files, not from a query */
const MOCK_QUERIES: SourceQueries = { ...DEFAULT_SOURCE_QUERIES, kev: null }

/**
 * Reads and parses a JSON file.
 * @param {string} path - File path
 * @returns {Promise<unknown>} - Parsed content
 */
export const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8'))

/**
 * Reads one fixture state through the same mappers the live sources and the CISA feed use.
 * @param {string} dir - State directory
 * @returns {Promise<ParsedSource>} - Parsed state, KEV ids from its catalog file
 */
const readState = async (dir: string): Promise<ParsedSource> => ({
  ...parseSourceData(
    {
      vulnerabilityReports: await readJson(join(dir, FIXTURE_FILES.vulnerabilityReports)),
      findingInfo: await readJson(join(dir, FIXTURE_FILES.findingInfo)),
    },
    MOCK_QUERIES,
  ),
  kevIds: parseKevFeed(await readJson(join(dir, FIXTURE_FILES.kevCatalog))).entries.map(
    (entry) => entry.cveId,
  ),
})

/**
 * Creates the mock source over the generated fixtures in raw source shapes. Fetches alternate
 * between two states per process: odd fetches (the first sync) return fixtures/base, even
 * fetches return base with fixtures/next applied, which resolves the findings in
 * next/resolved.json, raises some severities, adds new findings and KEV catalog entries. A sync in mock
 * mode therefore flips between both states, showing first_seen, resolved_at and reappearance.
 * @param {MockSourceOptions} options - Clock and an optional fixtures directory
 * @returns {FindingSource} - Source
 */
export const createMockSource = ({
  clock,
  fixturesDir = MOCK_FIXTURES_DIR,
}: MockSourceOptions): FindingSource => {
  let fetches = 0

  return {
    kind: 'mock',
    fetchSnapshot: async () => {
      const useNext = fetches % 2 === 1
      fetches += 1

      const base = await readState(join(fixturesDir, 'base'))

      if (!useNext) {
        return buildSnapshot(base, clock().toISOString(), MOCK_QUERIES)
      }

      const nextDir = join(fixturesDir, 'next')
      const resolved = (await readJson(join(nextDir, FIXTURE_FILES.resolved))) as FindingKey[]

      return buildSnapshot(
        applyNextTick(base, await readState(nextDir), resolved),
        clock().toISOString(),
        MOCK_QUERIES,
      )
    },
  }
}
