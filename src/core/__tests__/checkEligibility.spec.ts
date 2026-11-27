import { describe, expect, it } from 'vitest'

import type { AccessScope } from '#core/accessScope.ts'
import { CHECK_SKIP_REASONS } from '#core/check.ts'
import { eligibilityFactsOf, findingCheckBlocker } from '#core/checkEligibility.ts'
import type { ImageAccessSources, PullProbeResult } from '#core/imageVisibility.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/registryHost.ts'

const SCOPE: AccessScope = {
  id: 1,
  label: 'GitLab',
  uses: ['registry'],
  registryHost: 'registry.gitlab.com',
  gitHost: null,
  pathPrefix: 'acme',
  repoMapping: null,
}

/**
 * Builds sources with one stored probe answer for every image.
 * @param {PullProbeResult | null} probe - Probe answer, null for never probed
 * @param {readonly AccessScope[]} scopes - Usable credentials
 * @returns {ImageAccessSources} - Sources
 */
const sourcesWith = (
  probe: PullProbeResult | null,
  scopes: readonly AccessScope[] = [],
): ImageAccessSources => ({
  probeOf: () => probe,
  publicRegistries: DEFAULT_PUBLIC_REGISTRIES,
  scopes,
})

describe('findingCheckBlocker', () => {
  it('names not_found, then resolved, then visibility_unknown or not_public', () => {
    const own = { ownership: 'own' as const }
    const other = { ownership: 'third_party' as const }

    expect(findingCheckBlocker(null)).toBe('not_found')
    expect(findingCheckBlocker({ resolved: true, visibility: 'public', ...own })).toBe('resolved')
    expect(findingCheckBlocker({ resolved: false, visibility: 'unknown', ...own })).toBe(
      'visibility_unknown',
    )
    expect(findingCheckBlocker({ resolved: false, visibility: 'unknown', ...other })).toBe(
      'not_public',
    )
    expect(findingCheckBlocker({ resolved: false, visibility: 'restricted', ...own })).toBe(
      'not_public',
    )
    expect(findingCheckBlocker({ resolved: false, visibility: 'public', ...own })).toBeNull()
    expect(findingCheckBlocker({ resolved: false, visibility: 'credential', ...other })).toBeNull()
  })

  it('checks in the order of CHECK_SKIP_REASONS', () => {
    expect(CHECK_SKIP_REASONS).toEqual([
      'not_found',
      'resolved',
      'not_public',
      'visibility_unknown',
      'already_open',
      'covered_by_proposal',
      'queue_full',
    ])
  })
})

describe('eligibilityFactsOf', () => {
  const own = { resolvedAt: null, imageRef: 'registry.gitlab.com/acme/shop', owner: 'self' }
  const third = { resolvedAt: null, imageRef: 'registry.gitlab.com/acme/shop', owner: 'platform' }

  it.each([
    ['own', 'public', [], null],
    ['own', 'credential', [SCOPE], null],
    ['own', 'restricted', [], 'not_public'],
    ['own', 'unknown', [], 'visibility_unknown'],
    ['third_party', 'public', [], null],
    ['third_party', 'credential', [SCOPE], null],
    ['third_party', 'restricted', [], 'not_public'],
    ['third_party', 'unknown', [], 'not_public'],
  ] as const)(
    'gives a %s image with visibility %s the blocker %s',
    (ownership, visibility, scopes, blocker) => {
      const finding = ownership === 'own' ? own : third
      const probe = visibility === 'public' || visibility === 'restricted' ? visibility : null
      const listed = ownership === 'third_party' && visibility === 'public'
      const sources = {
        ...sourcesWith(probe, scopes),
        publicRegistries: listed ? ['registry.gitlab.com'] : [],
      }
      const facts = eligibilityFactsOf(finding, sources)

      expect(facts).toEqual({
        resolved: false,
        visibility:
          ownership === 'third_party' && visibility === 'restricted' ? 'unknown' : visibility,
        ownership,
      })
      expect(findingCheckBlocker(facts)).toBe(blocker)
    },
  )

  it('answers null for an unknown finding and resolved for a resolved one', () => {
    expect(eligibilityFactsOf(null, sourcesWith(null))).toBeNull()
    expect(
      findingCheckBlocker(eligibilityFactsOf({ ...own, resolvedAt: 't' }, sourcesWith('public'))),
    ).toBe('resolved')
  })
})
