import { describe, expect, it } from 'vitest'

import {
  isPatchVerdict,
  PATCH_ACTION_HINT,
  patchActionOf,
  patchTargetOf,
} from '#core/patchAction.ts'

const FIX = {
  action: 'upgrade libxslt to 1.1.43-r4',
  layer: null,
  fixedVersion: null,
  change: null,
  effort: null,
}

describe('patch action', () => {
  it('counts needs_patch and fix_planned as patch verdicts', () => {
    expect(isPatchVerdict('needs_patch')).toBe(true)
    expect(isPatchVerdict('fix_planned')).toBe(true)
    expect(isPatchVerdict('accepted')).toBe(false)
    expect(isPatchVerdict('not_affected')).toBe(false)
    expect(isPatchVerdict('inconclusive')).toBe(false)
  })

  it('returns the action only for a patch verdict', () => {
    expect(patchActionOf({ verdict: 'needs_patch', fix: FIX })).toBe(FIX.action)
    expect(patchActionOf({ verdict: 'accepted', fix: FIX })).toBeNull()
    expect(patchActionOf({ verdict: 'inconclusive', fix: FIX })).toBeNull()
    expect(patchActionOf({ verdict: 'fix_planned', fix: null })).toBeNull()
    expect(patchActionOf({ verdict: 'fix_planned', fix: { ...FIX, action: null } })).toBeNull()
  })

  it('picks the digest, the stated fixed version or the target after "to"', () => {
    const digest = `sha256:${'ab12'.repeat(16)}`

    expect(patchTargetOf(`pin the image to ${digest}`, null)).toBe(digest)
    expect(patchTargetOf(`pin traefik@${digest}`, '3.3.5')).toBe(`traefik@${digest}`)
    expect(patchTargetOf('upgrade libxslt to 1.1.43-r4 (rebuild on the current base)', null)).toBe(
      '1.1.43-r4',
    )
    expect(patchTargetOf('bump the image to traefik:v3.3.5.', null)).toBe('traefik:v3.3.5')
    expect(patchTargetOf('rebuild so libxslt 1.1.43-r4 lands', '1.1.43-r4')).toBe('1.1.43-r4')
    expect(patchTargetOf('upgrade k3s to v1.33.4+k3s1', null)).toBe('v1.33.4+k3s1')
    expect(
      patchTargetOf(
        'wait for a k3s release that bundles metrics-server v0.9.1 (fixed upstream)',
        null,
      ),
    ).toBeNull()
    expect(patchTargetOf('no fixed version yet, watch the advisory', null)).toBeNull()
    expect(patchTargetOf('move to the new base image', null)).toBeNull()
  })

  it('prefers the target after "to" over a fixed version that is only its prefix', () => {
    expect(patchTargetOf('dependency: bump foo to 1.2.10', '1.2')).toBe('1.2.10')
    expect(patchTargetOf('dependency: bump golang.org/x/text to v0.39.0', '0.39')).toBe('v0.39.0')
  })

  it('matches the fixed version only as a whole token', () => {
    expect(patchTargetOf('rebuild so foo 1.2.10 lands', '1.2')).toBeNull()
    expect(patchTargetOf('rebuild so foo 1.2 lands.', '1.2')).toBe('1.2')
    expect(patchTargetOf('rebuild so foo v1.2-rc1 lands', '1.2')).toBeNull()
  })

  it('copies a tagged digest as a valid ref', () => {
    const hex = 'cd34'.repeat(16)

    expect(patchTargetOf(`image: bump to ghcr.io/x/y:1.2@sha256:${hex}`, null)).toBe(
      `ghcr.io/x/y@sha256:${hex}`,
    )
    expect(patchTargetOf(`image: bump to registry.local:5000/x/y:1.2@sha256:${hex}`, null)).toBe(
      `registry.local:5000/x/y@sha256:${hex}`,
    )
    expect(patchTargetOf(`image: bump to 1.2@sha256:${hex}`, null)).toBe(`sha256:${hex}`)
  })

  it('copies the base image to rebuild on for a base image action, not the package version', () => {
    const action = 'base image: rebuild on alpine:3.24.4 (libxslt 1.1.43-r4)'

    expect(patchTargetOf(action, '1.1.43-r4', 'base_image')).toBe('alpine:3.24.4')
    expect(patchTargetOf(action, '1.1.43-r4', null)).toBe('alpine:3.24.4')
    expect(patchTargetOf('rebuild on node:22.4.1-alpine3.20.', null, 'base_image')).toBe(
      'node:22.4.1-alpine3.20',
    )
    expect(patchTargetOf('base image: apk upgrade libxslt', '1.1.43-r4', 'base_image')).toBeNull()
    expect(
      patchTargetOf('base image: apk upgrade libxslt to 1.1.43-r4', '1.1.43-r4', 'base_image'),
    ).toBe('1.1.43-r4')
  })

  it('falls back to the fixed version for a rebuild of the republished tag', () => {
    const action =
      'base image: rebuild without cache and redeploy, alpine:3.24 now ships libxslt 1.1.43-r4'

    expect(PATCH_ACTION_HINT).toContain(
      '"base image: rebuild without cache and redeploy, <tag> now ships',
    )
    expect(patchTargetOf(action, '1.1.43-r4', 'base_image')).toBe('1.1.43-r4')
    expect(patchTargetOf(action, '1.1.43-r4', null)).toBe('1.1.43-r4')
    expect(patchTargetOf(action, null, 'base_image')).toBeNull()
  })
})
