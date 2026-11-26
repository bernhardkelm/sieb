import { describe, expect, it } from 'vitest'

import type { ImageAggregate } from '#core/imageAggregation.ts'
import { sortImages } from '@/components/images/imageSort'

/**
 * Builds an image aggregate.
 * @param {string} imageRef - Image
 * @param {Partial<ImageAggregate>} overrides - Fields to set
 * @returns {ImageAggregate} - Aggregate
 */
const image = (imageRef: string, overrides: Partial<ImageAggregate> = {}): ImageAggregate => ({
  imageRef,
  owner: 'third-party',
  maxExposure: 'internal',
  maxSeverity: 'High',
  openCount: 3,
  openBySeverity: { Critical: 0, High: 3, Medium: 0, Low: 0, Unknown: 0 },
  fixableCount: 0,
  kevCount: 0,
  inboxCount: 1,
  suppressedCount: 0,
  workloadCount: 1,
  workloads: [],
  ...overrides,
})

const IMAGES = [
  image('registry.example.com/acme/demo-app', { owner: 'self', openCount: 2 }),
  image('index.docker.io/library/nginx', {
    openBySeverity: { Critical: 1, High: 0, Medium: 4, Low: 0, Unknown: 0 },
    kevCount: 2,
  }),
  image('index.docker.io/library/redis', {
    openBySeverity: { Critical: 1, High: 2, Medium: 0, Low: 0, Unknown: 0 },
    workloadCount: 5,
  }),
]

/**
 * Returns the short names of images in order.
 * @param {readonly ImageAggregate[]} images - Images
 * @returns {string[]} - Last path segments
 */
const names = (images: readonly ImageAggregate[]): string[] =>
  images.map((entry) => entry.imageRef.split('/').at(-1)!)

describe('sortImages', () => {
  it('keeps the API order by default', () => {
    expect(names(sortImages(IMAGES, null))).toEqual(['demo-app', 'nginx', 'redis'])
  })

  it('sorts the severity breakdown by critical, then high and so on', () => {
    expect(names(sortImages(IMAGES, { column: 'severity', direction: 'desc' }))).toEqual([
      'redis',
      'nginx',
      'demo-app',
    ])
  })

  it('sorts names, counts and owner', () => {
    expect(names(sortImages(IMAGES, { column: 'name', direction: 'asc' }))).toEqual([
      'demo-app',
      'nginx',
      'redis',
    ])
    expect(names(sortImages(IMAGES, { column: 'kev', direction: 'desc' }))[0]).toBe('nginx')
    expect(names(sortImages(IMAGES, { column: 'workloads', direction: 'desc' }))[0]).toBe('redis')
    expect(names(sortImages(IMAGES, { column: 'open', direction: 'asc' }))[0]).toBe('demo-app')
    expect(names(sortImages(IMAGES, { column: 'owner', direction: 'desc' }))).toEqual([
      'nginx',
      'redis',
      'demo-app',
    ])
  })
})
