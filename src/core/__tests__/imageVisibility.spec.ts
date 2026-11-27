import { describe, expect, it } from 'vitest'

import type { AccessScope } from '#core/accessScope.ts'
import { imageCheckAccessOf } from '#core/imageCheckAccess.ts'
import {
  imageAccessOf,
  type ImageAccessSources,
  type PullProbeResult,
} from '#core/imageVisibility.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/registryHost.ts'

const SCOPE: AccessScope = {
  id: 1,
  label: 'acme',
  uses: ['registry'],
  registryHost: 'ghcr.io',
  gitHost: null,
  pathPrefix: 'acme',
  repoMapping: null,
}

/**
 * Builds sources with one probe answer for every image.
 * @param {PullProbeResult | null} probe - Probe answer, null for never probed
 * @param {readonly AccessScope[]} scopes - Usable credentials
 * @returns {ImageAccessSources} - Sources
 */
const sources = (
  probe: PullProbeResult | null,
  scopes: readonly AccessScope[] = [],
): ImageAccessSources => ({
  probeOf: () => probe,
  publicRegistries: DEFAULT_PUBLIC_REGISTRIES,
  scopes,
})

const OWN = { imageRef: 'ghcr.io/acme/app', owner: 'self' }

describe('imageAccessOf', () => {
  it('reads an own image from its probe: public before credential before restricted', () => {
    expect(imageAccessOf(OWN, sources('public', [SCOPE]))).toEqual({
      imageVisibility: 'public',
      ownership: 'own',
    })
    expect(imageAccessOf(OWN, sources('restricted', [SCOPE])).imageVisibility).toBe('credential')
    expect(imageAccessOf(OWN, sources('restricted')).imageVisibility).toBe('restricted')
    expect(imageAccessOf(OWN, sources('failed')).imageVisibility).toBe('unknown')
    expect(imageAccessOf(OWN, sources(null)).imageVisibility).toBe('unknown')
  })

  it('counts a third-party image on a listed registry public without a probe', () => {
    const third = { imageRef: 'ghcr.io/acme/app', owner: null }

    expect(imageAccessOf(third, sources('restricted'))).toEqual({
      imageVisibility: 'public',
      ownership: 'third_party',
    })
    expect(
      imageAccessOf(
        { imageRef: 'registry.example.com/acme/app', owner: 'platform' },
        sources(null),
      ),
    ).toEqual({ imageVisibility: 'unknown', ownership: 'third_party' })
  })
})

describe('imageCheckAccessOf', () => {
  it('names the credential, else public, else none', () => {
    expect(imageCheckAccessOf(OWN, sources('public', [SCOPE]))).toEqual({
      imageRef: 'ghcr.io/acme/app',
      level: 'credential',
      credentialId: 1,
      credentialLabel: 'acme',
    })
    expect(imageCheckAccessOf(OWN, sources(null))).toMatchObject({ level: 'none' })
    expect(imageCheckAccessOf(OWN, sources('public'))).toMatchObject({ level: 'public' })
    expect(imageCheckAccessOf({ ...OWN, owner: null }, sources(null))).toMatchObject({
      level: 'public',
    })
  })
})
