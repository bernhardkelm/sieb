import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { request, type RequestOptions } from 'node:https'
import type { LookupFunction } from 'node:net'
import { Readable } from 'node:stream'

import { isPublicAddress, urlRefusal } from '#server/credentials/probe/publicAddress.ts'

/** A probe request refused before or instead of connecting, its message is the short reason */
export class ProbeRefused extends Error {
  override name = 'ProbeRefused'
}

const NO_BODY_STATUSES = new Set([204, 205, 304])

/**
 * Wraps a DNS lookup so a connection only ever goes to vetted addresses: every address the name
 * resolves to must be public, else the lookup fails, and the connection uses exactly the
 * addresses vetted here, so a second resolution cannot swap them.
 * @param {typeof dnsLookup} lookup - DNS lookup, replaced in tests
 * @returns {LookupFunction} - Lookup for the request options
 */
export const vettedLookup =
  (lookup: typeof dnsLookup): LookupFunction =>
  (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true }, (error, found) => {
      const addresses = (Array.isArray(found) ? found : []) as LookupAddress[]

      if (error !== null) {
        callback(error, '', 0)
      } else if (addresses.length === 0 || !addresses.every((a) => isPublicAddress(a.address))) {
        callback(new ProbeRefused('address not allowed'), '', 0)
      } else if (options.all === true) {
        callback(null, addresses)
      } else {
        callback(null, addresses[0]?.address ?? '', addresses[0]?.family ?? 4)
      }
    })
  }

/**
 * Turns the response of a probe request into a fetch Response, without body for HEAD and the
 * statuses that have none.
 * @param {import('node:http').IncomingMessage} res - Response
 * @param {string} method - Request method
 * @returns {Response} - Response
 */
const toResponse = (res: import('node:http').IncomingMessage, method: string): Response => {
  const status = res.statusCode ?? 0
  const headers = new Headers()

  for (const [name, value] of Object.entries(res.headers)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      headers.append(name, item)
    }
  }

  if (status < 200 || status > 599) {
    res.destroy()
    throw new ProbeRefused('unexpected answer')
  }

  if (method === 'HEAD' || NO_BODY_STATUSES.has(status)) {
    res.resume()
    return new Response(null, { status, headers })
  }

  return new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, { status, headers })
}

/**
 * Creates the fetch of the credential test: https only, port 443 or a port the user set on the
 * credential, no internal names, and every resolved address vetted and pinned for the
 * connection, so the test cannot reach the cluster, the pod network or a metadata endpoint,
 * also not through DNS rebinding. Redirects are never followed.
 * @param {{ ports: readonly number[]; lookup?: typeof dnsLookup }} options - Allowed extra ports and the DNS lookup
 * @returns {typeof globalThis.fetch} - Fetch for string or URL targets
 */
export const createProbeFetch = ({
  ports,
  lookup = dnsLookup,
}: {
  ports: readonly number[]
  lookup?: typeof dnsLookup
}): typeof globalThis.fetch =>
  (async (input: string | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input))
    const refusal = urlRefusal(url, ports)
    const method = (init.method ?? 'GET').toUpperCase()

    if (refusal !== null) {
      throw new ProbeRefused(refusal)
    }

    const options: RequestOptions = {
      method,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      lookup: vettedLookup(lookup),
      agent: false,
      signal: init.signal ?? undefined,
    }

    return new Promise<Response>((resolve, reject) => {
      const req = request(url, options, (res) => {
        try {
          resolve(toResponse(res, method))
        } catch (error) {
          reject(error as Error)
        }
      })

      req.on('error', reject)
      req.end()
    })
  }) as typeof globalThis.fetch
