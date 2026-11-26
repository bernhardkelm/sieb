// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createInclusterSource } from '#server/sources/incluster/inclusterSource.ts'
import { DEFAULT_SOURCE_QUERIES } from '#server/sources/sourceQueries.ts'

import {
  INFO_LABELS,
  reportList,
  vector,
  VULNERABILITY,
} from '#server/sources/mapping/__tests__/sourceSamples.ts'

describe('createInclusterSource', () => {
  it('fetches reports with the ServiceAccount token and queries Prometheus', async () => {
    const requests: { url: string; headers: Record<string, string> }[] = []
    /**
     * Answers the three source requests and records them.
     * @param {string} url - Request URL
     * @param {RequestInit} init - Request options
     * @returns {Promise<Response>} - Response
     */
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      requests.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
      const body = url.includes('vulnerabilityreports')
        ? reportList([VULNERABILITY])
        : vector(url.includes('trivy_finding') ? [INFO_LABELS] : [{ vuln_id: 'CVE-2021-44228' }])

      return new Response(JSON.stringify(body), { status: 200 })
    }) as typeof fetch
    const source = createInclusterSource({
      prometheusUrl: 'http://prometheus:9090/',
      queries: DEFAULT_SOURCE_QUERIES,
      clock: () => new Date('2026-06-01T00:00:00.000Z'),
      fetch: fakeFetch,
      readToken: async () => 'token-1',
    })

    const snapshot = await source.fetchSnapshot()

    expect(requests.map((request) => request.url)).toEqual([
      'https://kubernetes.default.svc/apis/aquasecurity.github.io/v1alpha1/vulnerabilityreports',
      'http://prometheus:9090/api/v1/query?query=sieb%3Atrivy_finding%3Ainfo',
      'http://prometheus:9090/api/v1/query?query=sieb%3Akev%3Alisted',
    ])
    expect(requests[0]?.headers.Authorization).toBe('Bearer token-1')
    expect(snapshot.instances).toHaveLength(1)
  })

  it('rejects on a non-2xx response', async () => {
    const source = createInclusterSource({
      prometheusUrl: 'http://prometheus:9090',
      queries: DEFAULT_SOURCE_QUERIES,
      clock: () => new Date(),
      fetch: (async () => new Response('forbidden', { status: 403 })) as unknown as typeof fetch,
      readToken: async () => 'token-1',
    })

    await expect(source.fetchSnapshot()).rejects.toThrow(/failed with 403/)
  })
})
