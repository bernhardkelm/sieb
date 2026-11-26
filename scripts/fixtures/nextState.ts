import type { FindingKey } from '#core/finding.ts'
import type { FixtureCve, FixtureModel } from '#scripts/fixtures/fixtureModel.ts'
import { emit, type FixtureState } from '#scripts/fixtures/fixtureStates.ts'
import { generateCve } from '#scripts/fixtures/generateCve.ts'
import { PACKAGE_VARIANTS } from '#scripts/fixtures/packageVariants.ts'
import type { Random } from '#scripts/fixtures/random.ts'
import { imageRefOf } from '#scripts/fixtures/rawShapes.ts'

export interface NextState extends FixtureState {
  resolved: FindingKey[]
}

/**
 * Builds the next state as an overlay on base: the demo-app npm, demo-worker pypi and postgres
 * perl CVEs resolve, a new openssl CVE appears in every alpine openssl image and a new Go CVE in
 * prometheus, two Medium or Low findings are re-rated Critical and one more CVE is KEV listed.
 * @param {FixtureModel} model - Model
 * @param {Random} random - Generator
 * @param {ReadonlySet<string>} baseKev - KEV ids of the base state
 * @returns {NextState} - Raw overlay
 */
export const buildNextState = (
  model: FixtureModel,
  random: Random,
  baseKev: ReadonlySet<string>,
): NextState => {
  const images = [...model.images.values()]
  const resolved = images.flatMap((image) =>
    image.cves
      .filter(
        ({ cve }) =>
          (image.id === 'demo-app' && cve.family === 'npm') ||
          (image.id === 'demo-worker' && cve.family === 'pypi') ||
          (image.id === 'postgres' && cve.family === 'perl'),
      )
      .map(({ cve }) => ({ vulnId: cve.id, imageRef: imageRefOf(image) })),
  )
  const used = new Set(model.cves.map((cve) => cve.id))
  /**
   * Generates a new High CVE re-rated from its score.
   * @param {string} family - CVE family id
   * @param {string} title - Title
   * @param {number} score - CVSS score
   * @returns {FixtureCve} - CVE
   */
  const newCve = (family: string, title: string, score: number): FixtureCve => ({
    ...generateCve(random, family, title, used),
    score,
    severity: 'High',
    severitySource: 'cvss',
  })
  const openssl = newCve('openssl', 'openssl: heap overflow in X.400 address processing', 8.1)
  const stdlib = newCve('stdlib', 'golang: net/http: unbounded header growth in HTTP/2 server', 7.5)
  const opensslApk =
    PACKAGE_VARIANTS.find((variant) => variant.id === 'openssl-apk')?.packages ?? []
  const added = emit(model, (image) => [
    ...(image.os.family === 'alpine' && image.variants.includes('openssl-apk')
      ? [{ cve: openssl, packages: opensslApk }]
      : []),
    ...(image.id === 'prometheus'
      ? [{ cve: stdlib, packages: [{ name: 'stdlib', installed: 'v1.22.7', fixed: '1.22.12' }] }]
      : []),
  ])
  const resolvedKeys = new Set(resolved.map((key) => `${key.vulnId} ${key.imageRef}`))
  const risers = images
    .flatMap((image) => image.cves.map((entry) => ({ image, entry })))
    .filter(
      ({ image, entry }) =>
        ['Medium', 'Low'].includes(entry.cve.severity) &&
        !resolvedKeys.has(`${entry.cve.id} ${imageRefOf(image)}`),
    )
    .slice(0, 2)
  const rerated = emit(model, (image) =>
    risers
      .filter((riser) => riser.image.id === image.id)
      .map(({ entry }) => ({
        ...entry,
        cve: { ...entry.cve, severity: 'Critical', score: 9.4, severitySource: 'cvss' },
      })),
  )
  const riserIds = new Set(risers.map(({ entry }) => entry.cve.id))
  const newlyListed = images
    .flatMap((image) => image.cves)
    .find(({ cve }) => !baseKev.has(cve.id) && !riserIds.has(cve.id))?.cve.id

  return {
    reports: added.reports,
    info: [...added.info, ...rerated.info],
    kevIds: newlyListed ? [newlyListed] : [],
    resolved,
  }
}
