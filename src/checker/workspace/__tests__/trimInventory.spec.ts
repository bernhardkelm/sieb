// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { trimInventory } from '#checker/workspace/trimInventory.ts'

/**
 * Builds a syft document with many artifacts carrying bulky metadata.
 * @param {number} count - Number of artifacts
 * @returns {string} - syft JSON
 */
const syftJson = (count: number): string =>
  JSON.stringify({
    distro: { id: 'debian', versionID: '12' },
    source: { name: 'image', type: 'directory' },
    artifacts: Array.from({ length: count }, (_, index) => ({
      name: `pkg${index}`,
      version: '1.0',
      type: 'deb',
      purl: `pkg:deb/debian/pkg${index}@1.0`,
      locations: [{ path: `/var/lib/dpkg/status.d/pkg${index}` }],
      metadata: { files: 'x'.repeat(500) },
    })),
  })

describe('trimInventory', () => {
  it('keeps a small inventory unchanged', () => {
    const raw = syftJson(2)

    expect(trimInventory(raw, 10_000)).toBe(raw)
  })

  it('drops metadata and cuts artifacts to the size limit', () => {
    const trimmed = JSON.parse(trimInventory(syftJson(2000), 50_000))

    expect(Buffer.byteLength(JSON.stringify(trimmed))).toBeLessThanOrEqual(50_000)
    expect(trimmed.distro).toEqual({ id: 'debian', versionID: '12' })
    expect(trimmed.artifactCount).toBe(2000)
    expect(trimmed.omittedArtifacts).toBe(2000 - trimmed.artifacts.length)
    expect(trimmed.artifacts[0]).toEqual({
      name: 'pkg0',
      version: '1.0',
      type: 'deb',
      purl: 'pkg:deb/debian/pkg0@1.0',
      paths: ['/var/lib/dpkg/status.d/pkg0'],
    })
  })
})
