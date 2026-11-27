import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import { errorMessage } from '#core/errorMessage.ts'
import { ownershipOf } from '#core/imageVisibility.ts'
import type { PullProbeOutcome } from '#server/visibility/anonymousPullProbe.ts'
import {
  isFreshProbe,
  probeReferenceOf,
  readPullProbe,
  storePullProbe,
} from '#server/visibility/pullProbeRepository.ts'

/** Probes own images on demand and caches the answers */
export interface PullProber {
  probeOwn: (images: readonly ProbeCandidate[], waitMs: number) => Promise<void> // resolves when the probes ended or waitMs passed
}

/** An image a caller wants a fresh visibility of */
export interface ProbeCandidate {
  imageRef: string
  owner: string | null
}

/** Runs one probe of an image repository at a digest or tag */
export type ProbeImage = (imageRef: string, reference: string) => Promise<PullProbeOutcome>

export interface PullProberDeps {
  db: DatabaseSync
  clock: Clock
  probeImage: ProbeImage
  log?: (message: string) => void
  maxPerMinute?: number // probes started per minute over every caller, 10 by default
}

const WINDOW_MS = 60_000

/**
 * Creates the on-demand pull prober: only own images without a fresh cached answer are probed,
 * a probe of the same image already running is joined instead of started again, and at most
 * maxPerMinute probes start per minute; beyond that an image keeps its cached or unknown
 * visibility until a later request.
 * @param {PullProberDeps} deps - Database, clock, probe, logger and rate limit
 * @returns {PullProber} - Prober
 */
export const createPullProber = ({
  db,
  clock,
  probeImage,
  log = console.log,
  maxPerMinute = 10,
}: PullProberDeps): PullProber => {
  const inFlight = new Map<string, Promise<void>>()
  const starts: number[] = []

  /**
   * Takes one slot of the rate limit.
   * @param {number} now - Current time in milliseconds
   * @returns {boolean} - False when the limit is reached
   */
  const takeSlot = (now: number): boolean => {
    while (starts.length > 0 && now - (starts[0] ?? 0) >= WINDOW_MS) {
      starts.shift()
    }

    if (starts.length >= maxPerMinute) {
      return false
    }

    starts.push(now)
    return true
  }

  /**
   * Starts or joins the probe of one image.
   * @param {string} imageRef - Image ref of an own image
   * @returns {Promise<void> | null} - Running probe, null when fresh or rate limited
   */
  const start = (imageRef: string): Promise<void> | null => {
    const running = inFlight.get(imageRef)
    const now = clock()

    if (running !== undefined) {
      return running
    }

    if (isFreshProbe(readPullProbe(db, imageRef), now) || !takeSlot(now.getTime())) {
      return null
    }

    const run = probeImage(imageRef, probeReferenceOf(db, imageRef))
      .then((outcome) => {
        storePullProbe(db, imageRef, outcome, clock())
        log(
          `[sieb] pull probe ${imageRef}: ${outcome.result}${outcome.reason ? ` (${outcome.reason})` : ''}`,
        )
      })
      .catch((error: unknown) => {
        log(`[sieb] pull probe ${imageRef} failed: ${errorMessage(error)}`)
      })
      .finally(() => {
        inFlight.delete(imageRef)
      })

    inFlight.set(imageRef, run)
    return run
  }

  return {
    probeOwn: async (images, waitMs) => {
      const refs = new Set(
        images.filter((image) => ownershipOf(image.owner) === 'own').map((image) => image.imageRef),
      )
      const runs = [...refs].map(start).filter((run) => run !== null)
      let timer: ReturnType<typeof setTimeout> | undefined

      if (runs.length === 0) {
        return
      }

      await Promise.race([
        Promise.all(runs),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, waitMs)
        }),
      ])
      clearTimeout(timer)
    },
  }
}
