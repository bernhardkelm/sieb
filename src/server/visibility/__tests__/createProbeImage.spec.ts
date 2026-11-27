// @vitest-environment node
import type { LookupAddress } from 'node:dns'

import { describe, expect, it } from 'vitest'

import { createProbeFetch } from '#server/credentials/probe/probeHttps.ts'
import { createProbeImage } from '#server/visibility/createProbeImage.ts'

/**
 * Creates a DNS lookup that answers one fixed address for every name.
 * @param {string} address - Address to answer
 * @returns {{ lookup: typeof import('node:dns').lookup; names: string[] }} - Lookup and the names it was asked for
 */
const fixedLookup = (address: string) => {
  const names: string[] = []
  const lookup = ((
    hostname: string,
    _options: unknown,
    callback: (error: Error | null, found: LookupAddress[]) => void,
  ) => {
    names.push(hostname)
    callback(null, [{ address, family: address.includes(':') ? 6 : 4 }])
  }) as unknown as typeof import('node:dns').lookup

  return { lookup, names }
}

describe('createProbeImage', () => {
  it('refuses a registry that resolves to a private address before connecting', async () => {
    const { lookup, names } = fixedLookup('10.0.0.7')
    const probe = createProbeImage({ requestMs: 1000, totalMs: 2000 }, (ports) =>
      createProbeFetch({ ports, lookup }),
    )

    expect(await probe('registry.example.com/acme/shop', 'v1')).toEqual({
      result: 'failed',
      reason: 'address not allowed',
    })
    expect(names).toEqual(['registry.example.com'])
  })

  it('refuses an in-cluster name without resolving it', async () => {
    const { lookup, names } = fixedLookup('203.0.113.9')
    const probe = createProbeImage({}, (ports) => createProbeFetch({ ports, lookup }))

    expect(await probe('registry.registry.svc.cluster.local/acme/shop', 'v1')).toEqual({
      result: 'failed',
      reason: 'address not allowed',
    })
    expect(names).toEqual([])
  })

  it('allows the port the image host names and answers through the fetch it builds', async () => {
    const asked: number[][] = []
    const urls: string[] = []
    const probe = createProbeImage({}, (ports) => {
      asked.push(ports)

      return (async (input: string | URL) => {
        urls.push(String(input))
        return new Response(null, { status: 200 })
      }) as typeof globalThis.fetch
    })

    expect(await probe('registry.example.com:5000/acme/shop', 'v1')).toEqual({
      result: 'public',
      reason: null,
    })
    expect(await probe('ghcr.io/acme/shop', 'v1')).toMatchObject({ result: 'public' })
    expect(asked).toEqual([[5000], []])
    expect(urls[0]).toBe('https://registry.example.com:5000/v2/acme/shop/manifests/v1')
  })

  it('names an image ref without repository path failed', async () => {
    const probe = createProbeImage({}, () => {
      throw new Error('no fetch expected')
    })

    expect(await probe('ghcr.io/Not Valid', 'v1')).toEqual({
      result: 'failed',
      reason: 'invalid image ref',
    })
  })
})
