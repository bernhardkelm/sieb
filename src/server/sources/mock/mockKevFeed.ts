import { join } from 'node:path'

import { parseKevFeed, type KevFeed } from '#server/kev/parseKevFeed.ts'
import { FIXTURE_FILES, MOCK_FIXTURES_DIR, readJson } from '#server/sources/mock/mockSource.ts'

/**
 * Reads the fixture KEV catalog in place of the CISA feed, without network access: the base
 * catalog plus the entries the next state adds, so the details of every CVE either state lists
 * are stored. Each mock sync still takes its KEV list from its own fixture state.
 * @param {string} fixturesDir - Fixture directory with base and next
 * @returns {Promise<KevFeed>} - Validated catalog with the version of the next state
 */
export const readMockKevFeed = async (
  fixturesDir: string = MOCK_FIXTURES_DIR,
): Promise<KevFeed> => {
  const base = parseKevFeed(await readJson(join(fixturesDir, 'base', FIXTURE_FILES.kevCatalog)))
  const next = parseKevFeed(await readJson(join(fixturesDir, 'next', FIXTURE_FILES.kevCatalog)))
  const listed = new Set(base.entries.map((entry) => entry.cveId))

  return {
    catalogVersion: next.catalogVersion ?? base.catalogVersion,
    dateReleased: next.dateReleased ?? base.dateReleased,
    entries: [...base.entries, ...next.entries.filter((entry) => !listed.has(entry.cveId))],
    skipped: base.skipped + next.skipped,
  }
}
