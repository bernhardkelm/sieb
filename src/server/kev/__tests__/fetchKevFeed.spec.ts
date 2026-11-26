// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { fetchKevFeed } from '#server/kev/fetchKevFeed.ts'

import { rawKevEntry, rawKevFeed } from '#server/kev/__tests__/kevFeedFixtures.ts'

const URL = 'https://mirror.example.com/kev.json'

/**
 * Builds a fetch stub answering one response.
 * @param {Response} response - Answer
 * @returns {typeof globalThis.fetch} - Fetch stub
 */
const answering = (response: Response): typeof globalThis.fetch =>
  vi.fn<typeof globalThis.fetch>(async () => response)

/**
 * Builds a response streaming a body in chunks without a Content-Length.
 * @param {readonly string[]} chunks - Body chunks
 * @returns {Response} - Response
 */
const streamed = (chunks: readonly string[]): Response =>
  new Response(
    new ReadableStream({
      start: (controller) => {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }

        controller.close()
      },
    }),
  )

describe('fetchKevFeed', () => {
  it('downloads and validates the feed with a timeout', async () => {
    const fetchFn = answering(Response.json(rawKevFeed([rawKevEntry('CVE-2024-3400')])))
    const feed = await fetchKevFeed(URL, { fetch: fetchFn })

    expect(feed.entries.map((entry) => entry.cveId)).toEqual(['CVE-2024-3400'])
    expect(fetchFn).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('fails on a non-2xx answer', async () => {
    await expect(
      fetchKevFeed(URL, { fetch: answering(new Response('gone', { status: 503 })) }),
    ).rejects.toThrow(`GET ${URL} failed with 503`)
  })

  it('fails on invalid JSON and on a feed of the wrong shape', async () => {
    await expect(
      fetchKevFeed(URL, { fetch: answering(new Response('<html>maintenance</html>')) }),
    ).rejects.toThrow(/invalid JSON/)
    await expect(
      fetchKevFeed(URL, { fetch: answering(Response.json({ vulnerabilities: [] })) }),
    ).rejects.toThrow(/no valid entry/)
  })

  it('refuses bodies over the size limit, declared or streamed', async () => {
    const body = JSON.stringify(rawKevFeed([rawKevEntry('CVE-2024-3400')]))
    const declared = new Response(body, { headers: { 'Content-Length': '999999999' } })

    await expect(fetchKevFeed(URL, { fetch: answering(declared), maxBytes: 1024 })).rejects.toThrow(
      /999999999 bytes exceeds the limit of 1024 bytes/,
    )
    await expect(
      fetchKevFeed(URL, {
        fetch: answering(streamed([body, body, body])),
        maxBytes: body.length * 2,
      }),
    ).rejects.toThrow(/exceeds the limit/)
    await expect(
      fetchKevFeed(URL, {
        fetch: answering(streamed([body.slice(0, 50), body.slice(50)])),
        maxBytes: body.length,
      }),
    ).resolves.toMatchObject({ catalogVersion: '2026.11.24' })
  })

  it('passes network errors and timeouts on', async () => {
    const failing = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('fetch failed')
    })
    /**
     * Waits for the abort signal of the request.
     * @param {string | URL | Request} _url - Requested URL
     * @param {RequestInit | undefined} init - Request options with the signal
     * @returns {Promise<Response>} - Rejects once aborted
     */
    const hanging = (_url: string | URL | Request, init?: RequestInit): Promise<Response> =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error)
        })
      })

    await expect(fetchKevFeed(URL, { fetch: failing })).rejects.toThrow('fetch failed')
    await expect(fetchKevFeed(URL, { fetch: hanging, timeoutMs: 10 })).rejects.toThrow(
      /timeout|aborted/i,
    )
  })
})
