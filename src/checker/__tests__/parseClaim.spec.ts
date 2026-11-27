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
})
