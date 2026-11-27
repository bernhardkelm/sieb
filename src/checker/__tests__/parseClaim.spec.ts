// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { MAX_CHECK_MAX_TURNS, MAX_CHECK_TIMEOUT_SECONDS } from '#core/checkLimits.ts'
import { CLAIM } from '#checker/__tests__/checkFixtures.ts'
import { parseClaim } from '#checker/api/parseClaim.ts'

const DIGEST = `sha256:${'c'.repeat(64)}`

/**
 * Returns the field a claim is rejected for.
 * @param {Record<string, unknown>} change - Fields to override in CLAIM
 * @returns {string | null} - Rejected field, null when the claim is accepted
 */
const rejected = (change: Record<string, unknown>): string | null => {
  try {
    parseClaim({ ...CLAIM, ...change })

    return null
  } catch (error) {
    return (error as Error).message.replace('invalid claim: ', '')
  }
}

describe('parseClaim', () => {
  it('accepts tagged and digest-pinned claims and defaults a missing imageDigest to null', () => {
    expect(parseClaim({ ...CLAIM, imageDigest: undefined }).imageDigest).toBeNull()
    expect(
      parseClaim({ ...CLAIM, imageRef: `docker.io/library/nginx@${DIGEST}`, imageDigest: DIGEST }),
    ).toMatchObject({ imageDigest: DIGEST })
    expect(rejected({ imageRef: 'registry:5000/team/app:1.2', imageDigest: DIGEST })).toBeNull()
  })

  it('rejects mcp URLs other than http and https', () => {
    expect(rejected({ mcpUrl: 'file:///etc/passwd' })).toBe('mcpUrl')
    expect(rejected({ mcpUrl: 'javascript:alert(1)' })).toBe('mcpUrl')
    expect(rejected({ mcpUrl: 'not a url' })).toBe('mcpUrl')
  })

  it('rejects empty prompts, long vulnerability ids and turn or timeout bounds', () => {
    expect(rejected({ prompt: '   ' })).toBe('prompt')
    expect(rejected({ vulnId: '' })).toBe('vulnId')
    expect(rejected({ vulnId: 'C'.repeat(201) })).toBe('vulnId')
    expect(rejected({ timeoutSeconds: 0 })).toBe('timeoutSeconds')
    expect(rejected({ timeoutSeconds: MAX_CHECK_TIMEOUT_SECONDS + 1 })).toBe('timeoutSeconds')
    expect(rejected({ maxTurns: 1.5 })).toBe('maxTurns')
    expect(rejected({ maxTurns: MAX_CHECK_MAX_TURNS + 1 })).toBe('maxTurns')
    expect(rejected({ maxTurns: MAX_CHECK_MAX_TURNS })).toBeNull()
  })

  it('rejects image refs with whitespace, newlines, a leading dash or no tag or digest', () => {
    expect(rejected({ imageRef: 'nginx:1.27 --insecure' })).toBe('imageRef')
    expect(rejected({ imageRef: 'nginx:1.27\n' })).toBe('imageRef')
    expect(rejected({ imageRef: '-nginx:1' })).toBe('imageRef')
    expect(rejected({ imageRef: 'docker.io/library/nginx' })).toBe('imageRef')
    expect(rejected({ imageRef: 'registry:5000/app' })).toBe('imageRef')
    expect(rejected({ imageRef: 'nginx@sha256:short' })).toBe('imageRef')
  })

  it('rejects a malformed scanned digest or one that contradicts the reference', () => {
    expect(rejected({ imageDigest: 'sha256:xyz' })).toBe('imageDigest')
    expect(rejected({ imageDigest: 42 })).toBe('imageDigest')
    expect(
      rejected({
        imageRef: `docker.io/library/nginx@${DIGEST}`,
        imageDigest: `sha256:${'d'.repeat(64)}`,
      }),
    ).toBe('imageDigest')
  })

  it('fills the single image of a claim without images, as an older sieb sends it', () => {
    expect(parseClaim({ ...CLAIM, images: undefined }).images).toEqual([
      { imageRef: CLAIM.imageRef, imageDigest: null, tag: '1.27' },
    ])
    expect(
      parseClaim({ ...CLAIM, imageRef: `docker.io/library/nginx@${DIGEST}`, imageDigest: DIGEST })
        .images,
    ).toEqual([{ imageRef: `docker.io/library/nginx@${DIGEST}`, imageDigest: DIGEST, tag: null }])
  })

  it('accepts images with the primary first and keeps at most three', () => {
    const images = ['c', 'd', 'e', 'f'].map((hex, index) => ({
      imageRef: `docker.io/library/postgres@sha256:${hex.repeat(64)}`,
      imageDigest: `sha256:${hex.repeat(64)}`,
      tag: index === 1 ? null : `1${index}-alpine`,
    }))
    const claim = parseClaim({ ...CLAIM, ...images[0], images })

    expect(claim.images).toEqual(images.slice(0, 3))
  })

  it('rejects images that do not start with the primary one, repeat or lack a digest', () => {
    const primary = { imageRef: `docker.io/library/nginx@${DIGEST}`, imageDigest: DIGEST, tag: '1' }
    const other = `sha256:${'d'.repeat(64)}`
    const extra = { imageRef: `docker.io/library/nginx@${other}`, imageDigest: other, tag: '2' }
    const base = { imageRef: primary.imageRef, imageDigest: DIGEST }

    expect(rejected({ ...base, images: [primary, extra] })).toBeNull()
    expect(rejected({ ...base, images: [extra, primary] })).toBe('images')
    expect(rejected({ ...base, images: [primary, primary] })).toBe('images')
    expect(rejected({ ...base, images: [] })).toBe('images')
    expect(rejected({ ...base, images: 'nginx' })).toBe('images')
    expect(
      rejected({
        ...base,
        images: [primary, { imageRef: 'nginx:2', imageDigest: null, tag: '2' }],
      }),
    ).toBe('images')
    expect(rejected({ ...base, images: [primary, { ...extra, tag: '../2' }] })).toBe('images')
    expect(rejected({ ...base, images: [primary, { ...extra, imageRef: '-x@' + other }] })).toBe(
      'images',
    )
    expect(rejected({ ...base, images: [primary, { ...extra, imageDigest: DIGEST }] })).toBe(
      'images',
    )
  })
})
