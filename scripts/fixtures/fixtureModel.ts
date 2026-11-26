import type { Severity } from '#core/severity.ts'
import { CVE_FAMILIES } from '#scripts/fixtures/cveFamilies.ts'
import { generateCve } from '#scripts/fixtures/generateCve.ts'
import { IMAGES, type ImageSpec } from '#scripts/fixtures/images.ts'
import { PACKAGE_VARIANTS, type VariantPackage } from '#scripts/fixtures/packageVariants.ts'
import type { Random } from '#scripts/fixtures/random.ts'
import { WORKLOADS, type WorkloadSpec } from '#scripts/fixtures/workloads.ts'

export interface FixtureCve {
  id: string
  family: string
  title: string
  score: number | null
  severity: Severity
  severitySource: 'cvss' | null
  trivySeverity: string // report severity, mostly UNKNOWN like the real reports
  publishedDate: string
}

export interface ImageCve {
  cve: FixtureCve
  packages: readonly VariantPackage[]
}

export interface FixtureImage extends ImageSpec {
  digest: string
  cves: ImageCve[]
}

export interface FixtureWorkload extends WorkloadSpec {
  resourceName: string
}

export interface FixtureModel {
  cves: FixtureCve[]
  images: Map<string, FixtureImage>
  workloads: FixtureWorkload[]
}

/**
 * Builds the resource name of a workload as the trivy-operator labels show it.
 * @param {Random} random - Generator
 * @param {WorkloadSpec} workload - Workload
 * @returns {string} - ReplicaSet and Job names with a suffix, others as is
 */
const resourceName = (random: Random, workload: WorkloadSpec): string => {
  if (workload.kind === 'ReplicaSet') {
    return `${workload.name}-${random.hex(9)}`
  }

  return workload.kind === 'Job'
    ? `${workload.name}-${random.int(28800000, 28899999)}`
    : workload.name
}

/**
 * Builds the fixture model: CVEs per family, the CVEs each image carries through its package
 * variants (shared families make CVEs span many images) and the workloads with resource names.
 * @param {Random} random - Generator
 * @returns {FixtureModel} - Model
 */
export const buildFixtureModel = (random: Random): FixtureModel => {
  const used = new Set<string>()
  const byFamily = new Map<string, FixtureCve[]>()

  for (const family of CVE_FAMILIES) {
    byFamily.set(
      family.id,
      Array.from({ length: family.count }, (_, index) =>
        generateCve(
          random,
          family.id,
          family.titles[index % family.titles.length] ?? family.id,
          used,
        ),
      ),
    )
  }

  const images = new Map<string, FixtureImage>()

  for (const image of IMAGES) {
    const cves: ImageCve[] = []

    for (const variantId of image.variants) {
      const variant = PACKAGE_VARIANTS.find((candidate) => candidate.id === variantId)

      for (const [index, cve] of (byFamily.get(variant?.family ?? '') ?? []).entries()) {
        const target = variant?.packages[index % variant.packages.length]

        if (variant && target && random.chance(0.85)) {
          cves.push({ cve, packages: variant.everyPackage ? variant.packages : [target] })
        }
      }
    }

    images.set(image.id, { ...image, digest: `sha256:${random.hex(64)}`, cves })
  }

  return {
    cves: [...byFamily.values()].flat(),
    images,
    workloads: WORKLOADS.map((workload) => ({
      ...workload,
      resourceName: resourceName(random, workload),
    })),
  }
}
