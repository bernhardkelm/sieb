/** PromQL expressions of the two Prometheus requests, SIEB_FINDINGS_QUERY and SIEB_KEV_QUERY */
export interface SourceQueries {
  findings: string
  kev: string | null // null skips the KEV request, the KEV source is not prometheus
}

export const DEFAULT_SOURCE_QUERIES = {
  findings: 'sieb:trivy_finding:info',
  kev: 'sieb:kev:listed',
} satisfies SourceQueries

/** kube-prometheus-stack default, as namespace/name:port */
export const DEFAULT_PROMETHEUS_SERVICE = 'monitoring/kube-prometheus-stack-prometheus:9090'

/** API path of all VulnerabilityReports across namespaces */
export const VULNERABILITY_REPORTS_PATH =
  '/apis/aquasecurity.github.io/v1alpha1/vulnerabilityreports'

/**
 * Builds the API server service proxy path of the Prometheus service.
 * @param {string} service - Service as namespace/name:port, validated by the config
 * @returns {string} - Proxy path without a trailing slash
 */
export const prometheusProxyPath = (service: string): string => {
  const slash = service.indexOf('/')

  return `/api/v1/namespaces/${service.slice(0, slash)}/services/${service.slice(slash + 1)}/proxy`
}

/**
 * Builds the instant query path of the Prometheus HTTP API.
 * @param {string} query - PromQL expression
 * @returns {string} - Path with the encoded query, relative to the Prometheus base URL
 */
export const prometheusQueryPath = (query: string): string =>
  `/api/v1/query?query=${encodeURIComponent(query)}`
