import { describe, expect, it } from 'vitest'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { aggregateImages } from '#core/imageAggregation.ts'
import { emptyAggregateFilters, hasAggregateFilters } from '@/components/filters/aggregateFilters'
import { countHiddenImages, filterImages } from '@/components/images/imageFilters'

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

/**
 * Builds an open finding governed by an active decision of a status.
 * @param {number} id - Finding id, also the decision id
 * @param {string} imageRef - Image
 * @param {'not_affected' | 'accepted'} status - Decision status
 * @returns {ReturnType<typeof buildFindingView>} - Finding
 */
const decided = (
  id: number,
  imageRef: string,
  status: 'not_affected' | 'accepted',
): ReturnType<typeof buildFindingView> =>
  buildFindingView({
    id,
    imageRef,
    vulnId: `CVE-${id}`,
    severity: 'Critical',
    decision: buildDecision({ id, vulnId: `CVE-${id}`, imageRef, status }),
    effective: { state: 'active' },
    inInbox: false,
  })

const IMAGES = aggregateImages([
  buildFindingView({ id: 1, imageRef: NGINX, severity: 'Low' }),
  decided(2, NGINX, 'not_affected'),
  decided(3, NGINX, 'accepted'),
  decided(4, REDIS, 'not_affected'),
])

describe('filterImages', () => {
  it('leaves not affected findings and images with nothing else open out by default', () => {
    const filters = emptyAggregateFilters()
    const images = filterImages(IMAGES, filters)

    expect(hasAggregateFilters(filters)).toBe(false)
    expect(images.map((image) => image.imageRef)).toEqual([NGINX])
    expect(images[0]).toMatchObject({
      openCount: 2,
      openBySeverity: { Critical: 1, Low: 1 },
      notAffectedCount: 1,
      acceptedCount: 1,
    })
    expect(countHiddenImages(IMAGES, filters)).toBe(1)
  })

  it('counts every open finding and lists every image with showNotAffected', () => {
    const filters = { ...emptyAggregateFilters(), showNotAffected: true }
    const images = filterImages(IMAGES, filters)

    expect(hasAggregateFilters(filters)).toBe(true)
    expect(images.map((image) => [image.imageRef, image.openCount])).toEqual([
      [NGINX, 3],
      [REDIS, 1],
    ])
    expect(countHiddenImages(IMAGES, filters)).toBe(0)
  })

  it('counts only hidden images that pass the other filters', () => {
    const filters = { ...emptyAggregateFilters(), q: 'nginx' }

    expect(countHiddenImages(IMAGES, filters)).toBe(0)
    expect(countHiddenImages(IMAGES, { ...filters, q: 'redis' })).toBe(1)
  })
})
