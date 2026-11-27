// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import type { PullProbeOutcome } from '#server/visibility/anonymousPullProbe.ts'
import { createPullProber } from '#server/visibility/pullProber.ts'
import { readPullProbe, storePullProbe } from '#server/visibility/pullProbeRepository.ts'

const START = new Date('2026-06-01T12:00:00.000Z')
const OWN = 'ghcr.io/acme/app'
const HOUR = 60 * 60_000

/**
 * Creates a prober over an empty database with a movable clock and a probe the test answers.
 * @param {{ outcome?: PullProbeOutcome; hold?: boolean }} options - Answer of every probe, and whether probes wait for release()
 * @returns {object} - Database, prober, probed image refs, clock control and release
 */
const setup = ({
  outcome = { result: 'public', reason: null },
  hold = false,
}: { outcome?: PullProbeOutcome; hold?: boolean } = {}) => {
  const db = openDatabase(MEMORY_DB)
  const probed: string[] = []
  const waiting: (() => void)[] = []
  let now = START.getTime()
  const prober = createPullProber({
    db,
    clock: () => new Date(now),
    log: () => {},
    probeImage: async (imageRef) => {
      probed.push(imageRef)

      if (hold) {
        await new Promise<void>((resolve) => waiting.push(resolve))
      }

      return outcome
    },
  })

  return {
    db,
    prober,
    probed,
    advance: (ms: number) => {
      now += ms
    },
    release: () => {
      waiting.splice(0).forEach((resolve) => resolve())
    },
  }
}

describe('createPullProber', () => {
  it('probes own images only and stores the answer', async () => {
    const { db, prober, probed } = setup()

    await prober.probeOwn(
      [
        { imageRef: OWN, owner: 'self' },
        { imageRef: 'docker.io/library/nginx', owner: null },
        { imageRef: 'ghcr.io/other/tool', owner: 'platform' },
      ],
      1000,
    )

    expect(probed).toEqual([OWN])
    expect(readPullProbe(db, OWN)).toEqual({
      result: 'public',
      reason: null,
      probedAt: START.toISOString(),
    })
  })

  it('keeps a fresh answer for its lifetime and probes again once it is stale', async () => {
    for (const [result, ttl] of [
      ['public', 7 * 24 * HOUR],
      ['restricted', 24 * HOUR],
      ['failed', HOUR],
    ] as const) {
      const { db, prober, probed, advance } = setup()

      storePullProbe(db, OWN, { result, reason: null }, START)
      advance(ttl - 1)
      await prober.probeOwn([{ imageRef: OWN, owner: 'self' }], 1000)

      expect(probed).toEqual([])

      advance(1)
      await prober.probeOwn([{ imageRef: OWN, owner: 'self' }], 1000)

      expect(probed).toEqual([OWN])
    }
  })

  it('joins a probe of the same image that is still running', async () => {
    const { db, prober, probed, release } = setup({ hold: true })
    const own = [{ imageRef: OWN, owner: 'self' }]
    const first = prober.probeOwn(own, 5000)
    const second = prober.probeOwn([...own, ...own], 5000)

    release()
    await Promise.all([first, second])

    expect(probed).toEqual([OWN])
    expect(readPullProbe(db, OWN)?.result).toBe('public')
  })

  it('starts at most 10 probes per minute', async () => {
    const { prober, probed, advance } = setup({ outcome: { result: 'failed', reason: 'timeout' } })
    const images = Array.from({ length: 11 }, (_, index) => ({
      imageRef: `ghcr.io/acme/app-${index}`,
      owner: 'self',
    }))

    await prober.probeOwn(images, 1000)

    expect(probed).toHaveLength(10)
    expect(probed).not.toContain('ghcr.io/acme/app-10')

    advance(59_999)
    await prober.probeOwn(images, 1000)

    expect(probed).toHaveLength(10)

    advance(1)
    await prober.probeOwn(images, 1000)

    expect(probed).toEqual([...probed.slice(0, 10), 'ghcr.io/acme/app-10'])
  })

  it('stops waiting after waitMs and stores the answer when the probe ends later', async () => {
    const { db, prober, release } = setup({ hold: true })

    await prober.probeOwn([{ imageRef: OWN, owner: 'self' }], 10)

    expect(readPullProbe(db, OWN)).toBeNull()

    release()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(readPullProbe(db, OWN)?.result).toBe('public')
  })
})
