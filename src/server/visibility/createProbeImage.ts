import { splitImageRef } from '#core/imageRefParts.ts'
import { createProbeFetch } from '#server/credentials/probe/probeHttps.ts'
import { probeAnonymousPull } from '#server/visibility/anonymousPullProbe.ts'
import type { ProbeImage } from '#server/visibility/pullProber.ts'

/** Time limits of one pull probe */
export interface PullProbeTimings {
  requestMs: number
  totalMs: number
}

const DEFAULT_TIMINGS: PullProbeTimings = { requestMs: 5000, totalMs: 8000 }

/**
 * Returns the port a registry host names, for the probe fetch that allows only 443 otherwise.
 * @param {string} host - Registry host, possibly with a port
 * @returns {number[]} - The named port, empty without one
 */
const portsOf = (host: string): number[] => {
  const port = /:(\d{1,5})$/u.exec(host)?.[1]

  return port === undefined ? [] : [Number(port)]
}

/**
 * Creates the probe of one image over the credential test's vetted https fetch, without any
 * credential: public addresses only, no redirects, 5 seconds per request and 8 per probe.
 * @param {Partial<PullProbeTimings>} timings - Time limits, replaced in tests
 * @param {typeof globalThis.fetch} fetchFor - Builds the fetch for the allowed ports, replaced in tests
 * @returns {ProbeImage} - Probe
 */
export const createProbeImage =
  (
    timings: Partial<PullProbeTimings> = {},
    fetchFor: (ports: number[]) => typeof globalThis.fetch = (ports) => createProbeFetch({ ports }),
  ): ProbeImage =>
  async (imageRef, reference) => {
    const { requestMs, totalMs } = { ...DEFAULT_TIMINGS, ...timings }
    const parts = splitImageRef(imageRef)

    if (parts === null) {
      return { result: 'failed', reason: 'invalid image ref' }
    }

    return probeAnonymousPull(
      { fetch: fetchFor(portsOf(parts.host)), signal: AbortSignal.timeout(totalMs), requestMs },
      { imageRef, ...parts, reference },
    )
  }
