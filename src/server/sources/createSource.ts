import type { Clock } from '#core/clock.ts'
import type { ServerConfig } from '#server/config.ts'
import type { FindingSource } from '#server/sources/FindingSource.ts'
import { createInclusterSource } from '#server/sources/incluster/inclusterSource.ts'
import { createKubectlSource } from '#server/sources/kubectl/kubectlSource.ts'
import { createMockSource } from '#server/sources/mock/mockSource.ts'
import { withKevList } from '#server/sources/withKevList.ts'

export type SourceConfig = Pick<
  ServerConfig,
  'source' | 'kubeContext' | 'prometheusService' | 'prometheusUrl' | 'queries' | 'kevSource'
>

/**
 * Creates the finding source selected by SIEB_SOURCE, without its KEV list.
 * @param {SourceConfig} config - Source settings, queries with the KEV query only for the prometheus KEV source
 * @param {Clock} clock - Clock stamping fetchedAt
 * @returns {FindingSource} - Source
 */
const createFindingSource = (config: SourceConfig, clock: Clock): FindingSource => {
  switch (config.source) {
    case 'mock': {
      return createMockSource({ clock })
    }
    case 'kubectl': {
      return createKubectlSource({
        kubeContext: config.kubeContext,
        prometheusService: config.prometheusService,
        queries: config.queries,
        clock,
      })
    }
    case 'incluster': {
      return createInclusterSource({
        prometheusUrl: config.prometheusUrl,
        queries: config.queries,
        clock,
      })
    }
  }
}

/**
 * Creates the finding source selected by SIEB_SOURCE with the KEV list of SIEB_KEV_SOURCE: the
 * KEV query for prometheus, the stored catalog for cisa, an empty list for none. The mock source
 * takes its KEV list from the fixture state for cisa and prometheus.
 * @param {SourceConfig} config - Source, kubectl context, Prometheus service and URL, queries, KEV source
 * @param {Clock} clock - Clock stamping fetchedAt
 * @param {() => string[] | null} readCatalogIds - Ids of the stored CISA catalog, null before the first fetch
 * @returns {FindingSource} - Source
 */
export const createSource = (
  config: SourceConfig,
  clock: Clock,
  readCatalogIds: () => string[] | null,
): FindingSource => {
  const kevQuery = config.kevSource === 'prometheus' ? config.queries.kev : null
  const source = createFindingSource(
    { ...config, queries: { ...config.queries, kev: kevQuery } },
    clock,
  )

  if (config.kevSource === 'none') {
    return withKevList(source, () => [])
  }

  return config.kevSource === 'cisa' && config.source !== 'mock'
    ? withKevList(source, readCatalogIds)
    : source
}
