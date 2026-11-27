import type { DatabaseSync } from 'node:sqlite'

import type { ImageAccessSources, PullProbeResult } from '#core/imageVisibility.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { listUsableScopes } from '#server/db/credentialRepository.ts'
import { readPullProbe } from '#server/visibility/pullProbeRepository.ts'
import type { PullProber } from '#server/visibility/pullProber.ts'

/** What the routes need to tell the visibility of images */
export interface ImageAccessSetup {
  publicRegistries: readonly string[] // third-party images on these hosts count as public
  credentialVault: CredentialVault | null // vault of usable credentials, null while private access is off
  pullProber: PullProber | null // on-demand probe of own images, null in mock mode and tests
}

/**
 * Reads what decides the visibility of images for one request: the cached probes, read once per
 * image, and the usable credentials.
 * @param {DatabaseSync} db - Open database
 * @param {Pick<ImageAccessSetup, 'publicRegistries' | 'credentialVault'>} setup - Public registries and credential vault
 * @returns {ImageAccessSources} - Sources for imageAccessOf and the eligibility
 */
export const readImageAccessSources = (
  db: DatabaseSync,
  {
    publicRegistries,
    credentialVault,
  }: Pick<ImageAccessSetup, 'publicRegistries' | 'credentialVault'>,
): ImageAccessSources => {
  const probes = new Map<string, PullProbeResult | null>()

  return {
    probeOf: (imageRef) => {
      if (!probes.has(imageRef)) {
        probes.set(imageRef, readPullProbe(db, imageRef)?.result ?? null)
      }

      return probes.get(imageRef) ?? null
    },
    publicRegistries,
    scopes: listUsableScopes(db, credentialVault),
  }
}
