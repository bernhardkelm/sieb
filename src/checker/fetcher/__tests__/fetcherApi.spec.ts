// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createFetcherApi } from '#checker/fetcher/fetcherApi.ts'

/**
 * Creates the client with a fetch that answers with one status and body.
 * @param {number} status - HTTP status
 * @param {unknown} body - JSON body
 * @param {Request[]} seen - Receives the requests
 * @returns {ReturnType<typeof createFetcherApi>} - Client
 */
const client = (status: number, body: unknown, seen: Request[] = []) =>
  createFetcherApi({
    baseUrl: 'http://sieb:3101',
    secret: 'fetcher-secret',
    fetch: async (input, init) => {
      seen.push(new Request(input, init))

      return new Response(status === 204 ? null : JSON.stringify(body), { status })
    },
  })

describe('createFetcherApi', () => {
  it('posts to the check routes with the fetcher secret', async () => {
    const seen: Request[] = []

    const digest = `sha256:${'a'.repeat(64)}`
    const images = [{ imageRef: `ghcr.io/acme/app@${digest}`, imageDigest: digest, tag: null }]

    expect(await client(200, { registries: [], images }, seen).access(7)).toEqual({
      registries: [],
      images,
    })
    await client(200, { skip: 'no_repository' }, seen).source(7, {
      imageRef: 'ghcr.io/acme/app',
      sourceLabel: null,
      revisionLabel: null,
    })

    expect(seen.map((request) => [request.method, request.url])).toEqual([
      ['POST', 'http://sieb:3101/worker/checks/7/access'],
      ['POST', 'http://sieb:3101/worker/checks/7/source'],
    ])
    expect(seen.map((request) => request.headers.get('authorization'))).toEqual([
      'Bearer fetcher-secret',
      'Bearer fetcher-secret',
    ])
  })

  it('names a check that ended and other failures', async () => {
    await expect(client(409, {}).access(7)).rejects.toThrow(
      'the check is no longer running in sieb',
    )
    await expect(client(409, { error: 'check_not_running' }).access(7)).rejects.toThrow(
      'the check is no longer running in sieb',
    )
    await expect(client(409, { error: 'not_pullable' }).access(7)).rejects.toThrow(
      'the image is no longer pullable',
    )
    await expect(client(404, {}).access(7)).rejects.toThrow(
      'the check is no longer running in sieb',
    )
    await expect(client(500, {}).access(7)).rejects.toThrow(
      'registry access request failed: sieb answered 500',
    )
    await expect(client(200, { registries: 'x' }).access(7)).rejects.toThrow(
      'sieb sent an invalid registry access answer',
    )
  })
})
