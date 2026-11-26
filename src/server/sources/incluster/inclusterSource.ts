import { readFile } from 'node:fs/promises'

import type { Clock } from '#core/clock.ts'
import type { FindingSource } from '#server/sources/FindingSource.ts'
import { buildSnapshot, parseSourceData } from '#server/sources/mapping/buildSnapshot.ts'
import {
  prometheusQueryPath,
  VULNERABILITY_REPORTS_PATH,
  type SourceQueries,
} from '#server/sources/sourceQueries.ts'

export const KUBERNETES_API_URL = 'https://kubernetes.default.svc'

export const SERVICE_ACCOUNT_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token'

export const REQUEST_TIMEOUT_MS = 60_000

export interface InclusterSourceOptions {
  prometheusUrl: string
  queries: SourceQueries
  clock: Clock
  fetch?: typeof globalThis.fetch
  readToken?: () => Promise<string>
}

/**
 * Fetches a URL and parses the JSON body.
 * @param {typeof globalThis.fetch} fetchFn - Fetch implementation
 * @param {string} url - URL
 * @param {Record<string, string>} headers - Request headers
 * @returns {Promise<unknown>} - Parsed body
 * @throws {Error} - For non-2xx responses and timeouts
 */
const fetchJson = async (
  fetchFn: typeof globalThis.fetch,
  url: string,
  headers: Record<string, string>,
): Promise<unknown> => {
  const response = await fetchFn(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`)
  }

  return response.json()
}

/**
 * Creates the in-cluster source. It reads the ServiceAccount token on every fetch, since the
 * kubelet rotates it, and trusts the cluster CA through NODE_EXTRA_CA_CERTS pointing at
 * /var/run/secrets/kubernetes.io/serviceaccount/ca.crt, set in the Deployment.
 * @param {InclusterSourceOptions} options - Prometheus URL, queries, clock, optional fetch and token reader
 * @returns {FindingSource} - Source
 */
export const createInclusterSource = ({
  prometheusUrl,
  queries,
  clock,
  fetch: fetchFn = globalThis.fetch,
  readToken = async () => (await readFile(SERVICE_ACCOUNT_TOKEN_PATH, 'utf8')).trim(),
}: InclusterSourceOptions): FindingSource => ({
  kind: 'incluster',
  fetchSnapshot: async () => {
    const token = await readToken()
    const base = prometheusUrl.replace(/\/+$/, '')
    const [reports, info, kev] = await Promise.all([
      fetchJson(fetchFn, `${KUBERNETES_API_URL}${VULNERABILITY_REPORTS_PATH}`, {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      }),
      fetchJson(fetchFn, `${base}${prometheusQueryPath(queries.findings)}`, {}),
      queries.kev === null
        ? undefined
        : fetchJson(fetchFn, `${base}${prometheusQueryPath(queries.kev)}`, {}),
    ])

    return buildSnapshot(
      parseSourceData(
        { vulnerabilityReports: reports, findingInfo: info, kevListed: kev },
        queries,
      ),
      clock().toISOString(),
      queries,
    )
  },
})
