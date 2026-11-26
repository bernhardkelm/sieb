import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { FIXTURE_FILES, MOCK_FIXTURES_DIR } from '#server/sources/mock/mockSource.ts'
import { buildFixtureModel, type FixtureModel } from '#scripts/fixtures/fixtureModel.ts'
import { buildBaseState, type FixtureState } from '#scripts/fixtures/fixtureStates.ts'
import { kevCatalog, type KevCatalogMeta } from '#scripts/fixtures/kevCatalog.ts'
import { buildNextState } from '#scripts/fixtures/nextState.ts'
import { createRandom, type Random } from '#scripts/fixtures/random.ts'

const SEED = 20261125

const BASE_CATALOG: KevCatalogMeta = {
  catalogVersion: '2026.11.20',
  dateReleased: '2026-11-20T15:02:11.0000Z',
  dateAdded: (random) =>
    `${random.pick([2023, 2024, 2025, 2026])}-${String(random.int(1, 10)).padStart(2, '0')}-${String(random.int(10, 28))}`,
}

const NEXT_CATALOG: KevCatalogMeta = {
  catalogVersion: '2026.11.25',
  dateReleased: '2026-11-25T14:47:03.0000Z',
  dateAdded: () => '2026-11-25',
}

/**
 * Serialises a list wrapper with one item per line, so fixture diffs stay readable.
 * @param {string} head - JSON text up to the opening bracket of the list
 * @param {readonly unknown[]} items - List items
 * @param {string} tail - JSON text after the closing bracket
 * @returns {string} - JSON text
 */
const listJson = (head: string, items: readonly unknown[], tail: string): string =>
  `${head}\n${items.map((item) => JSON.stringify(item)).join(',\n')}\n${tail}\n`

/**
 * Serialises a Prometheus instant vector response.
 * @param {readonly unknown[]} samples - Samples
 * @returns {string} - JSON text
 */
const vectorJson = (samples: readonly unknown[]): string =>
  listJson('{"status":"success","data":{"resultType":"vector","result":[', samples, ']}}')

/**
 * Serialises a KEV catalog in the shape of the CISA feed.
 * @param {ReturnType<typeof kevCatalog>} catalog - Top-level fields and entries
 * @returns {string} - JSON text
 */
const catalogJson = ({ head, entries }: ReturnType<typeof kevCatalog>): string =>
  listJson(`${JSON.stringify(head).slice(0, -1)},"vulnerabilities":[`, entries, ']}')

/**
 * Writes one fixture state directory in the raw source shapes.
 * @param {string} dir - Target directory
 * @param {FixtureState} state - Raw state
 * @param {string} kevJson - KEV catalog of the state in the CISA feed shape
 * @returns {number} - Bytes written
 */
const writeState = (dir: string, state: FixtureState, kevJson: string): number => {
  const files = {
    [FIXTURE_FILES.vulnerabilityReports]: listJson(
      '{"apiVersion":"v1","kind":"List","items":[',
      state.reports,
      '],"metadata":{"resourceVersion":""}}',
    ),
    [FIXTURE_FILES.findingInfo]: vectorJson(state.info),
    [FIXTURE_FILES.kevCatalog]: kevJson,
  }

  mkdirSync(dir, { recursive: true })

  return Object.entries(files).reduce((bytes, [name, text]) => {
    writeFileSync(join(dir, name), text)
    return bytes + Buffer.byteLength(text)
  }, 0)
}

/**
 * Serialises the KEV catalog of a state with its own generator, so the details never shift the
 * findings of the fixtures.
 * @param {FixtureState} state - Raw state
 * @param {FixtureModel} model - Model
 * @param {Random} random - Generator of the KEV details
 * @param {KevCatalogMeta} meta - Catalog version, release time and listing dates
 * @returns {string} - JSON text
 */
const stateCatalog = (
  state: FixtureState,
  model: FixtureModel,
  random: Random,
  meta: KevCatalogMeta,
): string => catalogJson(kevCatalog(state.kevIds, model, random, meta))

/**
 * Generates the deterministic mock fixtures: fixtures/base with the full state and fixtures/next
 * with the overlay the mock source applies on every second sync. The KEV catalog of next holds
 * only the newly listed entries.
 * @returns {void}
 */
const main = (): void => {
  const random = createRandom(SEED)
  const kevRandom = createRandom(SEED + 1)
  const model = buildFixtureModel(random)
  const base = buildBaseState(model, random)
  const next = buildNextState(model, random, new Set(base.kevIds))
  const nextDir = join(MOCK_FIXTURES_DIR, 'next')
  const resolvedJson = `${JSON.stringify(next.resolved, null, 2)}\n`

  let bytes = writeState(
    join(MOCK_FIXTURES_DIR, 'base'),
    base,
    stateCatalog(base, model, kevRandom, BASE_CATALOG),
  )
  bytes += writeState(nextDir, next, stateCatalog(next, model, kevRandom, NEXT_CATALOG))
  writeFileSync(join(nextDir, FIXTURE_FILES.resolved), resolvedJson)
  bytes += Buffer.byteLength(resolvedJson)

  const findings = new Set(
    base.info.map((sample) => {
      const labels = sample.metric as Record<string, unknown>
      return `${String(labels.vuln_id)} ${String(labels.image_ref)}`
    }),
  )

  console.log(
    `[sieb] fixtures written to ${MOCK_FIXTURES_DIR}: ${findings.size} findings, ${base.info.length} info series, ` +
      `${base.reports.length} reports, ${base.kevIds.length} KEV entries; next resolves ${next.resolved.length}, ` +
      `adds ${next.info.length} series and ${next.kevIds.length} KEV entries; ` +
      `${Math.round(bytes / 1024)} KiB`,
  )
}

main()
