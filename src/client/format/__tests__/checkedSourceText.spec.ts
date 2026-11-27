import { describe, expect, it } from 'vitest'

import type { CheckedSource } from '#core/privateAccess.ts'
import { checkedSourceText } from '@/format/checkedSourceText'

const COMMIT = '3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39'

/**
 * Builds a checked out source.
 * @param {Partial<CheckedSource>} overrides - Fields to set
 * @returns {CheckedSource} - Source
 */
const source = (overrides: Partial<CheckedSource>): CheckedSource => ({
  repoUrl: 'https://github.com/example-user/app.git',
  revision: COMMIT,
  fromLabel: true,
  refKind: 'label',
  ref: null,
  ...overrides,
})

describe('checkedSourceText', () => {
  it('names the commit of the revision label', () => {
    expect(checkedSourceText(source({}))).toBe('github.com/example-user/app@3f2a9c1')
  })

  it('names the tag matching the image tag with its commit', () => {
    expect(checkedSourceText(source({ refKind: 'tag', ref: 'v1.1.3' }))).toBe(
      'github.com/example-user/app at tag v1.1.3 (3f2a9c1)',
    )
    expect(checkedSourceText(source({ refKind: 'tag', ref: '1.1.3', revision: null }))).toBe(
      'github.com/example-user/app at tag 1.1.3',
    )
  })

  it('names the default branch, with its commit when known', () => {
    expect(checkedSourceText(source({ refKind: 'default_branch' }))).toBe(
      'github.com/example-user/app, default branch (3f2a9c1)',
    )
    expect(checkedSourceText(source({ refKind: 'default_branch', revision: null }))).toBe(
      'github.com/example-user/app, default branch',
    )
  })
})
