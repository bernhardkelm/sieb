// @vitest-environment node
import type { LookupAddress } from 'node:dns'

import { describe, expect, it } from 'vitest'

import { isInternalHostName } from '#core/internalHostNames.ts'
import { createProbeFetch, vettedLookup } from '#server/credentials/probe/probeHttps.ts'
import { errorReason } from '#server/credentials/probe/probeFetch.ts'
import { isPublicAddress, urlRefusal } from '#server/credentials/probe/publicAddress.ts'

/**
 * Creates a DNS lookup that answers fixed addresses for every name.
 * @param {string[]} addresses - Addresses to answer
 * @returns {{ lookup: typeof import('node:dns').lookup; names: string[] }} - Lookup and the names it was asked for
 */
const fixedLookup = (addresses: string[]) => {
  const names: string[] = []
  const lookup = ((
    hostname: string,
    _options: unknown,
    callback: (error: Error | null, found: LookupAddress[]) => void,
  ) => {
    names.push(hostname)
    callback(
      null,
      addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })),
    )
  }) as unknown as typeof import('node:dns').lookup

  return { lookup, names }
}

/**
 * Runs the vetted lookup once.
 * @param {string[]} addresses - Addresses the name resolves to
 * @param {boolean} all - Whether all addresses are asked for
 * @returns {Promise<{ error: Error | null; result: unknown }>} - Outcome
 */
const resolve = (addresses: string[], all: boolean) =>
  new Promise<{ error: Error | null; result: unknown }>((done) => {
    vettedLookup(fixedLookup(addresses).lookup)('gitlab.example.com', { all }, (error, result) =>
      done({ error, result: result as string | LookupAddress[] }),
    )
  })

describe('isPublicAddress', () => {
  it('refuses loopback, private, CGNAT, link-local, unique-local, unspecified and metadata addresses', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.1.1',
      '100.64.0.1',
      '100.100.100.200',
      '169.254.169.254',
      '0.0.0.0',
      '224.0.0.1',
      '::',
      '::1',
      'fd00:ec2::254',
      'fe80::1',
      '::ffff:127.0.0.1',
      '::ffff:a9fe:a9fe',
      '64:ff9b::10.0.0.1',
      '64:ff9b::a9fe:a9fe',
      'not an address',
    ]) {
      expect({ address, public: isPublicAddress(address) }).toEqual({ address, public: false })
    }
  })

  it('accepts public addresses, also embedded in NAT64', () => {
    for (const address of ['140.82.112.3', '2606:4700::6810:84e5', '64:ff9b::8c52:7003']) {
      expect({ address, public: isPublicAddress(address) }).toEqual({ address, public: true })
    }
  })
})

describe('urlRefusal', () => {
  it('allows https on 443 and on a port the credential names', () => {
    expect(urlRefusal(new URL('https://gitlab.example.com/a.git'), [])).toBeNull()
    expect(urlRefusal(new URL('https://gitlab.example.com:443/a'), [])).toBeNull()
    expect(urlRefusal(new URL('https://gitlab.example.com:8443/a'), [8443])).toBeNull()
  })

  it('refuses other ports, schemes, internal names and private IP literals', () => {
    expect(urlRefusal(new URL('https://gitlab.example.com:8443/a'), [])).toBe('port not allowed')
    expect(urlRefusal(new URL('http://gitlab.example.com/a'), [])).toBe('not https')

    for (const url of [
      'https://kubernetes.default.svc/api',
      'https://sieb.sieb.svc.cluster.local/x',
      'https://metadata.google.internal/x',
      'https://printer.local./x',
      'https://localhost/x',
      'https://intranet/x',
      'https://127.0.0.1/x',
      'https://0x7f.1/x',
      'https://[::1]/x',
      'https://[::ffff:169.254.169.254]/x',
    ]) {
      expect({ url, refusal: urlRefusal(new URL(url), [443]) }).toEqual({
        url,
        refusal: 'address not allowed',
      })
    }
  })

  it('shares the name rule with the credential validation', () => {
    expect(isInternalHostName('registry.ns.svc:5000')).toBe(true)
    expect(isInternalHostName('registry.example.com:5000')).toBe(false)
  })
})

describe('vettedLookup', () => {
  it('passes on public addresses in both lookup forms', async () => {
    expect(await resolve(['140.82.112.3', '2606:4700::1'], true)).toEqual({
      error: null,
      result: [
        { address: '140.82.112.3', family: 4 },
        { address: '2606:4700::1', family: 6 },
      ],
    })
    expect(await resolve(['140.82.112.3'], false)).toEqual({ error: null, result: '140.82.112.3' })
  })

  it('fails when any address the name resolves to is internal, as after DNS rebinding', async () => {
    const { error } = await resolve(['140.82.112.3', '10.0.0.5'], true)

    expect(error?.name).toBe('ProbeRefused')
    expect(errorReason(error)).toBe('address not allowed')
    expect((await resolve([], false)).error?.message).toBe('address not allowed')
  })
})

describe('createProbeFetch', () => {
  it('refuses before connecting and never resolves a refused name', async () => {
    const { lookup, names } = fixedLookup(['127.0.0.1'])
    const fetch = createProbeFetch({ ports: [], lookup })

    await expect(fetch('https://gitlab.example.com:22/x')).rejects.toThrow('port not allowed')
    await expect(fetch('https://10.0.0.1/x')).rejects.toThrow('address not allowed')
    expect(names).toEqual([])
  })

  it('does not connect to a public name that resolves to loopback', async () => {
    const { lookup, names } = fixedLookup(['127.0.0.1'])
    const fetch = createProbeFetch({ ports: [], lookup })
    const error = await fetch('https://registry.example.com/v2/').catch((caught: Error) => caught)

    expect(names).toEqual(['registry.example.com'])
    expect(errorReason(error)).toBe('address not allowed')
  })
})
