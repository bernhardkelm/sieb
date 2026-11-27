/** Image refs of the mock fixtures the seed refers to */
export const IMAGE = {
  nginx: 'index.docker.io/library/nginx',
  traefik: 'index.docker.io/rancher/mirrored-library-traefik',
  coredns: 'index.docker.io/rancher/mirrored-coredns-coredns',
  localPath: 'index.docker.io/rancher/local-path-provisioner',
  metricsServer: 'index.docker.io/rancher/mirrored-metrics-server',
  grafana: 'index.docker.io/grafana/grafana',
  prometheus: 'quay.io/prometheus/prometheus',
  alertmanager: 'quay.io/prometheus/alertmanager',
  certManager: 'quay.io/jetstack/cert-manager-controller',
  postgres: 'index.docker.io/library/postgres',
  redis: 'index.docker.io/library/redis',
  mariadb: 'index.docker.io/library/mariadb',
  demoApp: 'registry.example.com/acme/demo-app',
  demoWorker: 'registry.example.com/acme/demo-worker',
} as const

export interface FindingRef {
  id: number
  vulnId: string
  imageRef: string
  kev: boolean
}

export type FindingLookup = (vulnId: string, imageRef: string) => number

/**
 * Builds a lookup from CVE and image to the finding id, so the seed never depends on the
 * insertion order of the fixtures.
 * @param {readonly FindingRef[]} findings - Findings of GET /api/findings
 * @returns {FindingLookup} - Returns the id, throws for a finding the fixtures do not hold
 */
export const findingLookup = (findings: readonly FindingRef[]): FindingLookup => {
  const ids = new Map(
    findings.map((finding) => [`${finding.vulnId} ${finding.imageRef}`, finding.id]),
  )

  return (vulnId, imageRef) => {
    const id = ids.get(`${vulnId} ${imageRef}`)

    if (id === undefined) {
      throw new Error(`no mock finding ${vulnId} on ${imageRef}, were the fixtures regenerated?`)
    }

    return id
  }
}
