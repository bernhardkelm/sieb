import { z } from 'zod'

import { packageOrigins, type OriginFields } from '#core/packageOrigin.ts'

const MAX_ORIGINS = 10
const MAX_PATHS = 10

export const foundInSchema = z
  .array(
    z.object({
      package: z.string().nullable(),
      installed: z.string().nullable(),
      packageType: z.string().nullable().describe('such as gobinary, npm, debian, or os-pkgs'),
      purl: z.string().nullable(),
      paths: z
        .array(z.string())
        .describe(`binary, lockfile, package file or OS release, at most ${MAX_PATHS}`),
    }),
  )
  .describe(
    `Trivy report data, plain strings: where the package sits in the image, at most ${MAX_ORIGINS}; empty when unknown`,
  )

export type FoundIn = z.infer<typeof foundInSchema>

/**
 * Lists where Trivy found the packages of some instances of one image.
 * @param {readonly OriginFields[]} instances - Instances, usually the current ones
 * @returns {FoundIn} - One entry per package version
 */
export const toFoundIn = (instances: readonly OriginFields[]): FoundIn =>
  packageOrigins(instances)
    .slice(0, MAX_ORIGINS)
    .map((origin) => ({
      package: origin.package,
      installed: origin.installedVersion,
      packageType: origin.packageType,
      purl: origin.purl,
      paths: origin.paths.slice(0, MAX_PATHS),
    }))
