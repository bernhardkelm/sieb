// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { PULLED } from '#checker/__tests__/checkFixtures.ts'
import { parsePrepareAnswer } from '#checker/prepare/parsePrepareAnswer.ts'

const IMAGES = { prepared: [{ ...PULLED, dir: 'images/1-1.27' }], skipped: [] }
const CHECKED = {
  repoUrl: 'https://github.com/example/app.git',
  revision: 'c'.repeat(40),
  fromLabel: false,
  refKind: 'tag',
  ref: 'v1.1.3',
}

describe('parsePrepareAnswer source', () => {
  it('accepts every ref kind with its ref and the new miss reason', () => {
    expect(parsePrepareAnswer({ images: IMAGES, source: { checked: CHECKED } }).source).toEqual({
      checked: CHECKED,
    })

    for (const refKind of ['label', 'default_branch']) {
      expect(
        parsePrepareAnswer({
          images: IMAGES,
          source: { checked: { ...CHECKED, refKind, ref: null } },
        }).source,
      ).toMatchObject({ checked: { refKind } })
    }

    expect(
      parsePrepareAnswer({ images: IMAGES, source: { missing: 'needs_credential' } }).source,
    ).toEqual({ missing: 'needs_credential' })
  })

  it('refuses unknown ref kinds, invalid tags and a ref outside refKind tag', () => {
    for (const checked of [
      { ...CHECKED, refKind: 'branch' },
      { ...CHECKED, refKind: undefined },
      { ...CHECKED, ref: '-upload-pack=x' },
      { ...CHECKED, ref: 'a..b' },
      { ...CHECKED, ref: null },
      { ...CHECKED, refKind: 'default_branch' },
      { ...CHECKED, refKind: 'label', ref: undefined },
    ]) {
      expect(() => parsePrepareAnswer({ images: IMAGES, source: { checked } })).toThrow(
        'the fetcher sent an invalid answer',
      )
    }
  })
})
