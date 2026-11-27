import type { DatabaseSync } from 'node:sqlite'

import type { PullProbeResult } from '#core/imageVisibility.ts'
import type { PullProber, ProbeCandidate } from '#server/visibility/pullProber.ts'
import { storePullProbe } from '#server/visibility/pullProbeRepository.ts'

/** A prober that answers every own image with one result, and the calls it got */
export interface FakePullProber {
  prober: PullProber
  calls: { images: ProbeCandidate[]; waitMs: number }[]
  attach: (db: DatabaseSync) => void // database the answers are stored in
}

/**
 * Creates a pull prober for tests: it records each call and stores the given result for every
 * own image, or stores nothing to stand for a probe that did not answer in time.
 * @param {PullProbeResult | null} result - Stored result, null for a probe that times out
 * @param {Date} at - Probe time
 * @returns {FakePullProber} - Prober, calls and the database hook
 */
export const fakePullProber = (
  result: PullProbeResult | null,
  at = new Date('2026-06-01T12:00:00.000Z'),
): FakePullProber => {
  const calls: FakePullProber['calls'] = []
  let db: DatabaseSync | null = null

  return {
    calls,
    attach: (target) => {
      db = target
    },
    prober: {
      probeOwn: async (images, waitMs) => {
        calls.push({ images: [...images], waitMs })

        for (const image of images) {
          if (result !== null && db !== null && image.owner === 'self') {
            storePullProbe(db, image.imageRef, { result, reason: null }, at)
          }
        }
      },
    },
  }
}
