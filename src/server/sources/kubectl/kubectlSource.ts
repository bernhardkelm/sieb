import type { Clock } from '#core/clock.ts'
import type { FindingSource } from '#server/sources/FindingSource.ts'
import { runKubectl, type KubectlRunner } from '#server/sources/kubectl/runKubectl.ts'
import { buildSnapshot, parseSourceData } from '#server/sources/mapping/buildSnapshot.ts'
import {
  prometheusProxyPath,
  prometheusQueryPath,
  type SourceQueries,
} from '#server/sources/sourceQueries.ts'

export interface KubectlSourceOptions {
  kubeContext: string | null // null uses the current kubectl context
  prometheusService: string // namespace/name:port
  queries: SourceQueries
  clock: Clock
  run?: KubectlRunner
}

export type KubectlTarget = Pick<
  KubectlSourceOptions,
  'kubeContext' | 'prometheusService' | 'queries'
>

/**
 * Builds the read-only kubectl argument lists: the VulnerabilityReports of all namespaces and
 * the Prometheus queries through the API server service proxy.
 * @param {KubectlTarget} target - Context, Prometheus service and queries
 * @returns {{ reports: string[]; info: string[]; kev: string[] | null }} - Arguments per request, kev null without a KEV query
 */
export const kubectlArgs = ({
  kubeContext,
  prometheusService,
  queries,
}: KubectlTarget): { reports: string[]; info: string[]; kev: string[] | null } => {
  const context = kubeContext ? ['--context', kubeContext] : []
  const proxy = prometheusProxyPath(prometheusService)

  /**
   * Builds the arguments of a Prometheus query through the service proxy.
   * @param {string} query - PromQL expression
   * @returns {string[]} - Arguments
   */
  const raw = (query: string): string[] => [
    ...context,
    'get',
    '--raw',
    `${proxy}${prometheusQueryPath(query)}`,
  ]

  return {
    reports: [...context, 'get', 'vulnerabilityreports', '-A', '-o', 'json'],
    info: raw(queries.findings),
    kev: queries.kev === null ? null : raw(queries.kev),
  }
}

/**
 * Creates the local live source, which spawns kubectl against the configured context.
 * @param {KubectlSourceOptions} options - Context, Prometheus service, queries, clock and an optional runner for tests
 * @returns {FindingSource} - Source
 */
export const createKubectlSource = ({
  clock,
  run = runKubectl,
  ...target
}: KubectlSourceOptions): FindingSource => ({
  kind: 'kubectl',
  fetchSnapshot: async () => {
    const args = kubectlArgs(target)
    const [reports, info, kev] = await Promise.all([
      run(args.reports),
      run(args.info),
      args.kev === null ? null : run(args.kev),
    ])

    return buildSnapshot(
      parseSourceData(
        {
          vulnerabilityReports: JSON.parse(reports),
          findingInfo: JSON.parse(info),
          kevListed: kev === null ? undefined : JSON.parse(kev),
        },
        target.queries,
      ),
      clock().toISOString(),
      target.queries,
    )
  },
})
