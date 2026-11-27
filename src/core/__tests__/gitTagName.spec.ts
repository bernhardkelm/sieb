import { describe, expect, it } from 'vitest'

import { gitTagCandidates, isGitTagName } from '#core/gitTagName.ts'

describe('isGitTagName', () => {
  it('accepts plain release tags', () => {
    for (const name of ['1.1.3', 'v1.1.3', 'release_2', '1.0.0-rc.1', '1.0+build.5']) {
      expect(isGitTagName(name)).toBe(true)
    }
  })

  it('refuses names git or its command line could read differently', () => {
    for (const name of [
      '',
      '-x',
      '.hidden',
      'a..b',
      'a/b',
      'a b',
      'a:b',
      'a~1',
      'a^',
      'a@{1}',
      'end.',
      'tag.lock',
      'x'.repeat(130),
    ]) {
      expect(isGitTagName(name)).toBe(false)
    }
  })
})

describe('gitTagCandidates', () => {
  it('tries the image tag, then with a v prefix', () => {
    expect(gitTagCandidates('1.1.3')).toEqual(['1.1.3', 'v1.1.3'])
    expect(gitTagCandidates('v1.1.3')).toEqual(['v1.1.3'])
  })

  it('names none for latest, digest-only and invalid tags', () => {
    expect(gitTagCandidates('latest')).toEqual([])
    expect(gitTagCandidates(null)).toEqual([])
    expect(gitTagCandidates('-x')).toEqual([])
  })
})
