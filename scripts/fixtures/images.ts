export interface ImageSpec {
  id: string
  server: string
  repository: string
  tag: string
  owner: string // free-form owner label, self for own images
  os: { family: string; name: string }
  variants: readonly string[] // PackageVariant ids
}

const ALPINE = { family: 'alpine', name: '3.20.3' }
const DEBIAN = { family: 'debian', name: '12.7' }
const DOCKER_HUB = 'index.docker.io'
const OWN_REGISTRY = 'registry.example.com'

export const IMAGES: readonly ImageSpec[] = [
  {
    id: 'nginx',
    server: DOCKER_HUB,
    repository: 'library/nginx',
    tag: '1.27.2-alpine',
    owner: 'third-party',
    os: ALPINE,
    variants: ['openssl-apk', 'curl-apk', 'busybox-apk', 'libxml2-apk', 'zlib-apk', 'musl-apk'],
  },
  {
    id: 'postgres',
    server: DOCKER_HUB,
    repository: 'library/postgres',
    tag: '16.4',
    owner: 'third-party',
    os: DEBIAN,
    variants: [
      'openssl-deb',
      'krb5-deb',
      'perl-deb',
      'libxml2-deb',
      'zlib-deb',
      'glibc-deb',
      'stdlib-122',
    ],
  },
  {
    id: 'redis',
    server: DOCKER_HUB,
    repository: 'library/redis',
    tag: '7.4.1-alpine',
    owner: 'third-party',
    os: ALPINE,
    variants: ['openssl-apk', 'busybox-apk', 'musl-apk', 'stdlib-122'],
  },
  {
    id: 'mariadb',
    server: DOCKER_HUB,
    repository: 'library/mariadb',
    tag: '11.4.3',
    owner: 'third-party',
    os: DEBIAN,
    variants: ['openssl-deb', 'glibc-deb', 'perl-deb', 'zlib-deb'],
  },
  {
    id: 'busybox',
    server: DOCKER_HUB,
    repository: 'library/busybox',
    tag: '1.36.1-musl',
    owner: 'third-party',
    os: ALPINE,
    variants: ['busybox-apk'],
  },
  {
    id: 'grafana',
    server: DOCKER_HUB,
    repository: 'grafana/grafana',
    tag: '11.2.2',
    owner: 'third-party',
    os: ALPINE,
    variants: ['openssl-apk', 'busybox-apk', 'stdlib-123', 'xnet', 'jwt', 'grpc'],
  },
  {
    id: 'prometheus',
    server: 'quay.io',
    repository: 'prometheus/prometheus',
    tag: 'v2.54.1',
    owner: 'third-party',
    os: ALPINE,
    variants: ['stdlib-122', 'xnet', 'grpc'],
  },
  {
    id: 'alertmanager',
    server: 'quay.io',
    repository: 'prometheus/alertmanager',
    tag: 'v0.27.0',
    owner: 'third-party',
    os: ALPINE,
    variants: ['stdlib-122', 'xnet'],
  },
  {
    id: 'cert-manager',
    server: 'quay.io',
    repository: 'jetstack/cert-manager-controller',
    tag: 'v1.15.3',
    owner: 'third-party',
    os: ALPINE,
    variants: ['stdlib-123', 'xnet'],
  },
  {
    id: 'coredns',
    server: DOCKER_HUB,
    repository: 'rancher/mirrored-coredns-coredns',
    tag: '1.11.3',
    owner: 'platform',
    os: ALPINE,
    variants: ['stdlib-122', 'xnet', 'grpc'],
  },
  {
    id: 'traefik',
    server: DOCKER_HUB,
    repository: 'rancher/mirrored-library-traefik',
    tag: '3.1.4',
    owner: 'platform',
    os: ALPINE,
    variants: ['openssl-apk', 'busybox-apk', 'stdlib-123', 'xnet'],
  },
  {
    id: 'local-path',
    server: DOCKER_HUB,
    repository: 'rancher/local-path-provisioner',
    tag: 'v0.0.30',
    owner: 'platform',
    os: ALPINE,
    variants: ['busybox-apk', 'stdlib-122'],
  },
  {
    id: 'metrics-server',
    server: DOCKER_HUB,
    repository: 'rancher/mirrored-metrics-server',
    tag: 'v0.7.2',
    owner: 'platform',
    os: ALPINE,
    variants: ['stdlib-123', 'xnet'],
  },
  {
    id: 'demo-app',
    server: OWN_REGISTRY,
    repository: 'acme/demo-app',
    tag: '1.4.2',
    owner: 'self',
    os: ALPINE,
    variants: ['openssl-apk', 'busybox-apk', 'musl-apk', 'npm'],
  },
  {
    id: 'demo-worker',
    server: OWN_REGISTRY,
    repository: 'acme/demo-worker',
    tag: '0.9.0',
    owner: 'self',
    os: DEBIAN,
    variants: ['openssl-deb', 'glibc-deb', 'zlib-deb', 'pypi'],
  },
]
