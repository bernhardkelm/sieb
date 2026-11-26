// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createKubectlSource, kubectlArgs } from '#server/sources/kubectl/kubectlSource.ts'
import {
  DEFAULT_PROMETHEUS_SERVICE,
  DEFAULT_SOURCE_QUERIES,
} from '#server/sources/sourceQueries.ts'

import {
  INFO_LABELS,
  reportList,
  vector,
  VULNERABILITY,
} from '#server/sources/mapping/__tests__/sourceSamples.ts'

const TARGET = {
  kubeContext: null,
  prometheusService: DEFAULT_PROMETHEUS_SERVICE,
  queries: DEFAULT_SOURCE_QUERIES,
}

describe('kubectlArgs', () => {
  it('builds read-only commands against the current context by default', () => {
    const args = kubectlArgs(TARGET)

    expect(args.reports).toEqual(['get', 'vulnerabilityreports', '-A', '-o', 'json'])
    expect(args.info).toEqual([
      'get',
      '--raw',
      '/api/v1/namespaces/monitoring/services/kube-prometheus-stack-prometheus:9090/proxy/api/v1/query?query=sieb%3Atrivy_finding%3Ainfo',
    ])
    expect(args.kev?.at(-1)).toMatch(/query=sieb%3Akev%3Alisted$/)
  })

  it('passes the context, the Prometheus service and custom queries', () => {
    const args = kubectlArgs({
      kubeContext: 'prod',
      prometheusService: 'observability/prometheus-operated:web',
      queries: { findings: 'my:findings', kev: 'my:kev' },
    })

    expect(args.reports.slice(0, 2)).toEqual(['--context', 'prod'])
    expect(args.info).toEqual([
      '--context',
      'prod',
      'get',
      '--raw',
      '/api/v1/namespaces/observability/services/prometheus-operated:web/proxy/api/v1/query?query=my%3Afindings',
    ])
    expect(args.kev?.at(-1)).toMatch(/query=my%3Akev$/)
  })
})

describe('createKubectlSource', () => {
  it('runs the three commands and maps their output', async () => {
    const calls: string[][] = []
    const outputs = new Map([
      ['vulnerabilityreports', JSON.stringify(reportList([VULNERABILITY]))],
      ['trivy_finding', JSON.stringify(vector([INFO_LABELS]))],
      ['kev', JSON.stringify(vector([{ vuln_id: 'CVE-2021-44228' }]))],
    ])
    const source = createKubectlSource({
      ...TARGET,
      kubeContext: 'test',
      clock: () => new Date('2026-06-01T00:00:00.000Z'),
      run: async (args) => {
        calls.push([...args])
        const joined = args.join(' ')

        return [...outputs].find(([needle]) => joined.includes(needle))?.[1] ?? ''
      },
    })

    const snapshot = await source.fetchSnapshot()

    expect(calls).toHaveLength(3)
    expect(calls.every((args) => args[0] === '--context' && args[1] === 'test')).toBe(true)
    expect(snapshot.instances).toHaveLength(1)
    expect(snapshot.fetchedAt).toBe('2026-06-01T00:00:00.000Z')
  })

  it('skips the KEV query without one and leaves the KEV list to the KEV source', async () => {
    const calls: string[][] = []
    const source = createKubectlSource({
      ...TARGET,
      queries: { ...DEFAULT_SOURCE_QUERIES, kev: null },
      clock: () => new Date('2026-06-01T00:00:00.000Z'),
      run: async (args) => {
        calls.push([...args])

        return JSON.stringify(
          args.includes('vulnerabilityreports')
            ? reportList([VULNERABILITY])
            : vector([INFO_LABELS]),
        )
      },
    })

    const snapshot = await source.fetchSnapshot()

    expect(calls).toHaveLength(2)
    expect(calls.some((args) => args.join(' ').includes('kev'))).toBe(false)
    expect(snapshot.kevIds).toBeNull()
    expect(snapshot.instances).toHaveLength(1)
  })

  it('rejects when kubectl fails', async () => {
    const source = createKubectlSource({
      ...TARGET,
      kubeContext: 'test',
      clock: () => new Date(),
      run: async () => {
        throw new Error('kubectl get failed: forbidden')
      },
    })

    await expect(source.fetchSnapshot()).rejects.toThrow(/forbidden/)
  })
})
