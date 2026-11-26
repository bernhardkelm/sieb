import type { Exposure } from '#core/exposure.ts'

export interface WorkloadSpec {
  namespace: string
  kind: 'ReplicaSet' | 'StatefulSet' | 'DaemonSet' | 'Job' | 'CronJob' | 'Pod'
  name: string // owner name, ReplicaSet and Job names get a generated suffix
  exposure: Exposure | null // null emits no exposure label, as for workloads nobody mapped
  containers: readonly { name: string; image: string }[] // image is an ImageSpec id
}

/**
 * Builds a single-container workload.
 * @param {string} namespace - Namespace
 * @param {WorkloadSpec['kind']} kind - Resource kind
 * @param {string} name - Workload name, also the container name
 * @param {Exposure | null} exposure - Exposure, null for none
 * @param {string} image - ImageSpec id
 * @returns {WorkloadSpec} - Workload
 */
const single = (
  namespace: string,
  kind: WorkloadSpec['kind'],
  name: string,
  exposure: Exposure | null,
  image: string,
): WorkloadSpec => ({ namespace, kind, name, exposure, containers: [{ name, image }] })

export const WORKLOADS: readonly WorkloadSpec[] = [
  single('storefront', 'ReplicaSet', 'web', 'public', 'nginx'),
  {
    namespace: 'storefront',
    kind: 'ReplicaSet',
    name: 'api',
    exposure: 'public',
    containers: [
      { name: 'api', image: 'demo-app' },
      { name: 'proxy', image: 'nginx' },
    ],
  },
  single('storefront', 'ReplicaSet', 'worker', 'internal', 'demo-worker'),
  single('storefront', 'StatefulSet', 'cache', 'internal', 'redis'),
  single('storefront', 'StatefulSet', 'db', 'internal', 'postgres'),
  single('storefront', 'CronJob', 'db-backup', 'internal', 'postgres'),
  single('storefront-staging', 'ReplicaSet', 'web', 'gated', 'nginx'),
  single('storefront-staging', 'ReplicaSet', 'api', 'gated', 'demo-app'),
  single('storefront-staging', 'StatefulSet', 'cache', 'internal', 'redis'),
  single('storefront-staging', 'StatefulSet', 'db', 'internal', 'postgres'),
  single('storefront-staging', 'Job', 'migrate', 'internal', 'demo-app'),
  single('wiki', 'ReplicaSet', 'wiki-web', 'public', 'nginx'),
  single('wiki', 'StatefulSet', 'wiki-db', 'internal', 'mariadb'),
  single('wiki', 'CronJob', 'wiki-backup', 'internal', 'busybox'),
  single('analytics', 'ReplicaSet', 'dashboard', 'gated', 'grafana'),
  single('analytics', 'ReplicaSet', 'collector', 'public', 'demo-worker'),
  single('analytics', 'StatefulSet', 'events-db', 'internal', 'postgres'),
  single('analytics', 'StatefulSet', 'events-cache', 'internal', 'redis'),
  single('observability', 'StatefulSet', 'prometheus', 'gated', 'prometheus'),
  single('observability', 'StatefulSet', 'alertmanager', 'gated', 'alertmanager'),
  {
    namespace: 'observability',
    kind: 'ReplicaSet',
    name: 'grafana',
    exposure: 'gated',
    containers: [
      { name: 'grafana', image: 'grafana' },
      { name: 'init-chown', image: 'busybox' },
    ],
  },
  single('intranet', 'ReplicaSet', 'portal', 'gated', 'demo-app'),
  single('intranet', 'ReplicaSet', 'portal-proxy', 'gated', 'nginx'),
  single('intranet', 'StatefulSet', 'portal-db', 'internal', 'postgres'),
  single('intranet', 'StatefulSet', 'portal-cache', 'internal', 'redis'),
  single('intranet', 'CronJob', 'report-mailer', 'internal', 'demo-worker'),
  single('docs', 'ReplicaSet', 'docs', 'public', 'nginx'),
  single('docs', 'Pod', 'docs-preview', 'gated', 'nginx'),
  single('sandbox', 'Pod', 'redis-debug', 'internal', 'redis'),
  single('sandbox', 'ReplicaSet', 'demo-app-preview', 'gated', 'demo-app'),
  single('sandbox', 'StatefulSet', 'scratch-db', 'internal', 'mariadb'),
  single('kube-system', 'ReplicaSet', 'coredns', 'internal', 'coredns'),
  single('kube-system', 'ReplicaSet', 'traefik', 'public', 'traefik'),
  single('kube-system', 'ReplicaSet', 'local-path-provisioner', 'internal', 'local-path'),
  single('kube-system', 'ReplicaSet', 'metrics-server', 'internal', 'metrics-server'),
  single('kube-system', 'DaemonSet', 'svclb-traefik', 'public', 'traefik'),
  single('cert-manager', 'ReplicaSet', 'cert-manager', null, 'cert-manager'),
  single('cert-manager', 'ReplicaSet', 'cert-manager-webhook', null, 'cert-manager'),
  single('backup', 'CronJob', 'volume-snapshot', null, 'busybox'),
  single('backup', 'DaemonSet', 'node-agent', null, 'busybox'),
]
