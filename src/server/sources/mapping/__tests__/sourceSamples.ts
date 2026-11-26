/**
 * Builds a Prometheus instant vector response.
 * @param {Record<string, string>[]} metrics - Label sets
 * @returns {Record<string, unknown>} - Response body
 */
export const vector = (metrics: Record<string, string>[]): Record<string, unknown> => ({
  status: 'success',
  data: {
    resultType: 'vector',
    result: metrics.map((metric) => ({ metric, value: [1795645763.331, '1'] })),
  },
})

export const INFO_LABELS = {
  __name__: 'sieb:trivy_finding:info',
  exposure: 'internal',
  image_ref: 'index.docker.io/rancher/mirrored-coredns-coredns',
  namespace: 'kube-system',
  owner: 'platform',
  resource_kind: 'ReplicaSet',
  resource_name: 'coredns-7cfb7bc9c7',
  severity: 'High',
  severity_source: 'cvss',
  vuln_id: 'CVE-2023-28452',
  vuln_score: '7.5',
}

/**
 * Builds a VulnerabilityReport list with one report for the coredns workload.
 * @param {Record<string, unknown>[]} vulnerabilities - Report vulnerabilities
 * @returns {Record<string, unknown>} - List body
 */
export const reportList = (
  vulnerabilities: Record<string, unknown>[],
): Record<string, unknown> => ({
  apiVersion: 'v1',
  kind: 'List',
  items: [
    {
      apiVersion: 'aquasecurity.github.io/v1alpha1',
      kind: 'VulnerabilityReport',
      metadata: {
        name: 'replicaset-coredns-7cfb7bc9c7-coredns',
        namespace: 'kube-system',
        labels: {
          'trivy-operator.container.name': 'coredns',
          'trivy-operator.resource.kind': 'ReplicaSet',
          'trivy-operator.resource.name': 'coredns-7cfb7bc9c7',
          'trivy-operator.resource.namespace': 'kube-system',
        },
      },
      report: {
        artifact: {
          digest: 'sha256:abc',
          repository: 'rancher/mirrored-coredns-coredns',
          tag: '1.12.0',
        },
        registry: { server: 'index.docker.io' },
        vulnerabilities,
      },
    },
  ],
})

export const VULNERABILITY = {
  fixedVersion: '1.4.1',
  installedVersion: 'v1.4.0',
  links: [],
  primaryLink: 'https://avd.aquasec.com/nvd/cve-2023-28452',
  resource: 'github.com/coredns/coredns',
  score: 5.9,
  severity: 'UNKNOWN',
  title: 'coredns: DNS spoofing',
  vulnerabilityID: 'CVE-2023-28452',
}
