import { describe, expect, it } from 'vitest'

import { CHECK_SKIP_REASONS } from '#core/check.ts'
import { eligibilityFactsOf, findingCheckBlocker } from '#core/checkEligibility.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'

const PUBLIC = { resolvedAt: null, imageRef: 'docker.io/library/nginx', owner: null }

describe('findingCheckBlocker', () => {
  it('names not_found, then resolved, then not_public', () => {
    expect(findingCheckBlocker(null)).toBe('not_found')
    expect(findingCheckBlocker({ resolved: true, sourceAccess: 'private' })).toBe('resolved')
    expect(findingCheckBlocker({ resolved: false, sourceAccess: 'unknown' })).toBe('not_public')
    expect(findingCheckBlocker({ resolved: false, sourceAccess: 'public' })).toBeNull()
  })

  it('checks in the order of CHECK_SKIP_REASONS', () => {
    expect(CHECK_SKIP_REASONS.slice(0, 3)).toEqual(['not_found', 'resolved', 'not_public'])
    expect(CHECK_SKIP_REASONS.slice(3)).toEqual(['already_open', 'queue_full'])
  })
})

describe('eligibilityFactsOf', () => {
  it('derives resolution and source access of a stored finding', () => {
    expect(eligibilityFactsOf(null, DEFAULT_PUBLIC_REGISTRIES)).toBeNull()
    expect(eligibilityFactsOf(PUBLIC, DEFAULT_PUBLIC_REGISTRIES)).toEqual({
      resolved: false,
      sourceAccess: 'public',
      credentialAccess: false,
    })
    expect(
      eligibilityFactsOf({ ...PUBLIC, owner: 'self', resolvedAt: 't' }, DEFAULT_PUBLIC_REGISTRIES),
    ).toEqual({ resolved: true, sourceAccess: 'private', credentialAccess: false })
  })

  it('makes an own image checkable once a registry credential covers it', () => {
    const own = { resolvedAt: null, imageRef: 'registry.gitlab.com/acme/shop', owner: 'self' }
    const scope = {
      id: 1,
      label: 'GitLab',
      uses: ['registry' as const],
      registryHost: 'registry.gitlab.com',
      gitHost: null,
      pathPrefix: 'acme',
      repoMapping: null,
    }
    const covered = eligibilityFactsOf(own, DEFAULT_PUBLIC_REGISTRIES, [scope])
    const elsewhere = eligibilityFactsOf(own, DEFAULT_PUBLIC_REGISTRIES, [
      { ...scope, pathPrefix: 'other' },
    ])

    expect(covered).toEqual({ resolved: false, sourceAccess: 'private', credentialAccess: true })
    expect(findingCheckBlocker(covered)).toBeNull()
    expect(findingCheckBlocker(elsewhere)).toBe('not_public')
    expect(
      findingCheckBlocker({ resolved: true, sourceAccess: 'private', credentialAccess: true }),
    ).toBe('resolved')
  })
})
