import { describe, expect, it } from 'vitest'

import { checkedImagesOf, checkPullRef, type PullInstance } from '#core/checkPull.ts'

const IMAGE = 'ghcr.io/example/app'

/**
 * Returns a digest made of one repeated hex character.
 * @param {string} hex - Hex character
 * @returns {string} - Digest
 */
const digest = (hex: string): string => `sha256:${hex.repeat(64)}`

/**
 * Builds an instance with the fields the pull ref reads.
 * @param {Partial<PullInstance>} overrides - Fields to set
 * @returns {PullInstance} - Instance
 */
const instance = (overrides: Partial<PullInstance> = {}): PullInstance => ({
  id: 1,
  imageTag: null,
  imageDigest: null,
  lastSeen: '2026-06-01T00:00:00.000Z',
  resolvedAt: null,
  ...overrides,
})

/**
 * Returns a day of June 2026 as a lastSeen timestamp.
 * @param {number} day - Day of the month
 * @returns {string} - ISO timestamp
 */
const day = (day: number): string => `2026-06-${String(day).padStart(2, '0')}T00:00:00.000Z`

describe('checkPullRef', () => {
  it('pulls the digest of a single open instance with its tag', () => {
    expect(checkPullRef(IMAGE, [instance({ imageTag: '18', imageDigest: digest('c') })])).toEqual({
      imageRef: `${IMAGE}@${digest('c')}`,
      imageDigest: digest('c'),
      images: [{ imageRef: `${IMAGE}@${digest('c')}`, imageDigest: digest('c'), tag: '18' }],
      notPulled: [],
    })
  })

  it('pulls every distinct digest, most recently seen first', () => {
    const pull = checkPullRef(IMAGE, [
      instance({ id: 1, imageTag: '17.11-trixie', imageDigest: digest('d'), lastSeen: day(1) }),
      instance({ id: 2, imageTag: '18-alpine', imageDigest: digest('c'), lastSeen: day(2) }),
      instance({ id: 3, imageTag: '18', imageDigest: digest('c'), lastSeen: day(1) }),
    ])

    expect(pull?.imageRef).toBe(`${IMAGE}@${digest('c')}`)
    expect(pull?.images.map(({ imageDigest, tag }) => [imageDigest, tag])).toEqual([
      [digest('c'), '18-alpine'],
      [digest('d'), '17.11-trixie'],
    ])
    expect(pull?.notPulled).toEqual([])
  })

  it('keeps three of four digests and names the fourth, ignoring resolved instances', () => {
    const pull = checkPullRef(IMAGE, [
      ...['c', 'd', 'e', 'f'].map((hex, index) =>
        instance({
          id: index + 1,
          imageTag: `1${index}`,
          imageDigest: digest(hex),
          lastSeen: day(9 - index),
        }),
      ),
      instance({ id: 9, imageTag: 'old', imageDigest: digest('a'), resolvedAt: day(9) }),
    ])

    expect(pull?.images.map(({ tag }) => tag)).toEqual(['10', '11', '12'])
    expect(pull?.notPulled).toEqual([`13 (${digest('f').slice(0, 19)})`])
  })

  it('takes a tag of an older instance when the newest one with the digest has none', () => {
    const pull = checkPullRef(IMAGE, [
      instance({ id: 1, imageDigest: digest('c'), lastSeen: day(2) }),
      instance({ id: 2, imageTag: '18', imageDigest: digest('c'), lastSeen: day(1) }),
    ])

    expect(pull?.images).toEqual([
      { imageRef: `${IMAGE}@${digest('c')}`, imageDigest: digest('c'), tag: '18' },
    ])
  })

  it('pulls by the tag of the most recent instance only when no digest is known', () => {
    expect(
      checkPullRef(IMAGE, [
        instance({ id: 1, imageTag: '1.0', lastSeen: day(2) }),
        instance({ id: 2, imageTag: '0.9', lastSeen: day(1) }),
      ]),
    ).toEqual({
      imageRef: `${IMAGE}:1.0`,
      imageDigest: null,
      images: [{ imageRef: `${IMAGE}:1.0`, imageDigest: null, tag: '1.0' }],
      notPulled: ['0.9'],
    })
  })

  it('names a tag-only instance beside digests unless a pulled image carries its tag', () => {
    const pull = checkPullRef(IMAGE, [
      instance({ id: 1, imageTag: '1.0', imageDigest: digest('c'), lastSeen: day(3) }),
      instance({ id: 2, imageTag: '1.0', lastSeen: day(2) }),
      instance({ id: 3, imageTag: '0.9', lastSeen: day(1) }),
    ])

    expect(pull?.images).toHaveLength(1)
    expect(pull?.notPulled).toEqual(['0.9'])
  })

  it('never falls back to the bare ref, which would pull latest', () => {
    expect(
      checkPullRef(IMAGE, [
        instance({ imageDigest: digest('c'), resolvedAt: 't' }),
        instance({ id: 2, imageTag: '1.0 ; rm -rf /', imageDigest: 'sha256:xyz' }),
      ]),
    ).toBeNull()
    expect(checkPullRef(IMAGE, [])).toBeNull()
  })
})

describe('checkedImagesOf', () => {
  it('names each reported digest with the tag of an instance, else the tag of a pull by tag', () => {
    const instances = [
      instance({ id: 1, imageTag: '18', imageDigest: digest('c') }),
      instance({ id: 2, imageTag: '17', imageDigest: digest('d'), resolvedAt: day(3) }),
    ]

    expect(checkedImagesOf([digest('c'), digest('d'), digest('e')], instances)).toEqual([
      { digest: digest('c'), tag: '18' },
      { digest: digest('d'), tag: '17' },
      { digest: digest('e'), tag: null },
    ])
    expect(checkedImagesOf([digest('e')], [instance({ imageTag: '7.4' })])).toEqual([
      { digest: digest('e'), tag: '7.4' },
    ])
  })
})
