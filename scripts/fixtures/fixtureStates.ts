import type { FixtureImage, FixtureModel, ImageCve } from '#scripts/fixtures/fixtureModel.ts'
import { generateCve } from '#scripts/fixtures/generateCve.ts'
import type { Random } from '#scripts/fixtures/random.ts'
import { findingInfoSample, vulnerabilityReport } from '#scripts/fixtures/rawShapes.ts'

export interface FixtureState {
  reports: Record<string, unknown>[]
  info: Record<string, unknown>[]
  kevIds: string[] // CVE ids the KEV catalog of the state lists
}

/**
 * Builds the reports and info samples of the given CVEs for every workload running an image.
 * @param {FixtureModel} model - Model
 * @param {(image: FixtureImage) => readonly ImageCve[]} cvesOf - CVEs to emit per image
 * @returns {Omit<FixtureState, 'kevIds'>} - Reports and info samples
 */
export const emit = (
  model: FixtureModel,
  cvesOf: (image: FixtureImage) => readonly ImageCve[],
): Omit<FixtureState, 'kevIds'> => {
  const reports: Record<string, unknown>[] = []
  const info: Record<string, unknown>[] = []

  for (const workload of model.workloads) {
    const emitted = new Set<string>()

    for (const container of workload.containers) {
      const image = model.images.get(container.image)
      const cves = image ? cvesOf(image) : []

      if (!image || cves.length === 0) {
        continue
      }

      reports.push(vulnerabilityReport(workload, container.name, image, cves))

      if (!emitted.has(image.id)) {
        emitted.add(image.id)
        info.push(...cves.map((entry) => findingInfoSample(workload, image, entry)))
      }
    }
  }

  return { reports, info }
}

/**
 * Builds the base state: every image CVE in every workload, a handful of them KEV listed plus
 * KEV entries that match no finding, as the real list does.
 * @param {FixtureModel} model - Model
 * @param {Random} random - Generator
 * @returns {FixtureState} - Raw base state
 */
export const buildBaseState = (model: FixtureModel, random: Random): FixtureState => {
  const inUse = [
    ...new Set([...model.images.values()].flatMap((image) => image.cves.map(({ cve }) => cve.id))),
  ]
  const listed = new Set<string>()

  while (listed.size < 6) {
    listed.add(random.pick(inUse))
  }

  const decoys = new Set<string>(model.cves.map((cve) => cve.id))
  const kevIds = [...listed]

  for (let index = 0; index < 30; index += 1) {
    kevIds.push(generateCve(random, 'kev', 'kev', decoys).id)
  }

  return { ...emit(model, (image) => image.cves), kevIds: kevIds.sort() }
}
