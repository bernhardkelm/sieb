import type { WorkerClaimImage } from '#core/check.ts'

/** Hosting providers sieb stores read credentials for */
export const ACCESS_PROVIDERS = ['github', 'gitlab', 'dockerhub'] as const

export type AccessProvider = (typeof ACCESS_PROVIDERS)[number]

/** What a credential is used for: pulling images, cloning source */
export const ACCESS_USES = ['registry', 'git'] as const

export type AccessUse = (typeof ACCESS_USES)[number]

export interface ProviderSpec {
  label: string
  uses: readonly AccessUse[] // uses the provider supports
  registryHost: string | null // default registry host, null without a registry
  gitHost: string | null // default git host, null without git
  customHost: boolean // whether a self-hosted instance may set its own hosts
  needsUsername: boolean // whether the token needs a username (deploy tokens, Docker Hub)
}

export const PROVIDER_SPECS: Readonly<Record<AccessProvider, ProviderSpec>> = {
  github: {
    label: 'GitHub',
    uses: ['registry', 'git'],
    registryHost: 'ghcr.io',
    gitHost: 'github.com',
    customHost: false,
    needsUsername: false,
  },
  gitlab: {
    label: 'GitLab',
    uses: ['registry', 'git'],
    registryHost: 'registry.gitlab.com',
    gitHost: 'gitlab.com',
    customHost: true,
    needsUsername: true,
  },
  dockerhub: {
    label: 'Docker Hub',
    uses: ['registry'],
    registryHost: 'docker.io',
    gitHost: null,
    customHost: false,
    needsUsername: true,
  },
}

/** Registry path prefix to repository path prefix, for images without a source label */
export interface RepoMapping {
  registryPrefix: string // host/path prefix of the image, e.g. registry.gitlab.com/group/
  repoPrefix: string // host/path prefix of the repository, e.g. gitlab.com/group/
}

/** Outcome of testing one target with a credential */
export interface AccessTestFailure {
  target: string // image ref or repository URL
  reason: string // short reason, e.g. "401 unauthorized", "not found"
}

export interface AccessTestPart {
  checked: number
  ok: number
  failures: AccessTestFailure[] // at most a few, capped by the server
  denied?: number // targets refused with 401 or 403, over all failures; absent in tests before 0.6.1
  blocked?: number // targets on a private or in-cluster address sieb does not test; absent before 0.6.1
}

export interface AccessTestResult {
  at: string // ISO time of the test
  registry: AccessTestPart | null // null when the credential has no registry use
  git: AccessTestPart | null // null when the credential has no git use
  untested?: boolean // true when saved with confirmUntested because sieb may not reach its hosts
}

/** A stored credential as the API shows it; the secret never leaves the server except to the fetcher */
export interface AccessCredentialView {
  id: number
  provider: AccessProvider
  label: string
  uses: AccessUse[]
  registryHost: string | null
  gitHost: string | null
  pathPrefix: string // path within the hosts this credential covers, '' for the whole host
  repoMapping: RepoMapping | null
  username: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
  lastTest: AccessTestResult | null
  secretReadable?: boolean // false when the secret cannot be opened (another SIEB_CREDENTIALS_KEY, or the row was changed outside sieb), re-enter it; the server always sets it
}

/** POST /api/credentials body; PATCH takes the same fields, secret only to replace it */
export interface AccessCredentialInput {
  provider: AccessProvider
  label: string
  uses: AccessUse[]
  registryHost?: string | null // defaults to the provider's host, custom only where customHost
  gitHost?: string | null
  pathPrefix: string
  repoMapping?: RepoMapping | null
  username?: string | null
  secret: string
  confirmUntested?: boolean // stores a credential whose hosts sieb may not test, see testVerdict
}

/** Registry login the fetcher uses for one check's images */
export interface RegistryAuth {
  host: string
  username: string
  secret: string
  label?: string // label of the credential for failure texts, absent from older sieb versions
}

/** POST /worker/checks/:id/access answer, fetcher only: the claim's images and their registry logins */
export interface FetchAccess {
  registries: RegistryAuth[]
  images: WorkerClaimImage[] // the claim's images, primary first; the fetcher pulls these, never what the checker names
}

/** POST /worker/checks/:id/source body: what the fetcher read from the pulled primary image */
export interface SourceRequest {
  imageRef: string // repository without tag or digest
  sourceLabel: string | null // org.opencontainers.image.source
  revisionLabel: string | null // org.opencontainers.image.revision
}

/** Clone instructions for one repository; the secret reaches only the fetcher */
export interface SourceGrant {
  repoUrls: string[] // https URLs without credentials, 1 to 3, tried in order until one clones
  revision: string | null // commit of the revision label, null to try the image tag, then the default branch
  username: string | null // null together with secret: anonymous clone of a public repository
  secret: string | null
}

export const SOURCE_SKIP_REASONS = [
  'no_repository',
  'no_credential',
  'not_https',
  'foreign_repository', // the source label names a repository of another owner, no mapping covers the image
] as const

export type SourceSkipReason = (typeof SOURCE_SKIP_REASONS)[number]

export type SourceAnswer = { grant: SourceGrant } | { skip: SourceSkipReason }

/** What the worker reports about the source it checked out, part of the result */
export interface CheckedSource {
  repoUrl: string
  revision: string | null // commit checked out, null when git did not name it
  fromLabel: boolean // true when the image's source label named the repository
  refKind: CheckedRefKind
  ref: string | null // the git tag for refKind tag, else null
}

/** What chose the checked-out commit: the revision label, a git tag matching the image tag, or the default branch */
export const CHECKED_REF_KINDS = ['label', 'tag', 'default_branch'] as const

export type CheckedRefKind = (typeof CHECKED_REF_KINDS)[number]

const DOCKER_HUB_HOSTS = new Set(['docker.io', 'index.docker.io', 'registry-1.docker.io'])

/**
 * Normalises a host for matching: lower case, Docker Hub aliases folded into docker.io.
 * @param {string} host - Host as written
 * @returns {string} - Normalised host
 */
export const normalizeHost = (host: string): string => {
  const lower = host.trim().toLowerCase()

  return DOCKER_HUB_HOSTS.has(lower) ? 'docker.io' : lower
}

/**
 * Returns whether a credential's host and path prefix cover a host and path; an empty prefix
 * covers the whole host, a prefix matches whole path segments only.
 * @param {string} credentialHost - Host of the credential
 * @param {string} pathPrefix - Path prefix of the credential, '' for the whole host
 * @param {string} host - Host of the target
 * @param {string} path - Path of the target without leading slash
 * @returns {boolean} - True when covered
 */
export const coversTarget = (
  credentialHost: string,
  pathPrefix: string,
  host: string,
  path: string,
): boolean => {
  if (normalizeHost(credentialHost) !== normalizeHost(host)) {
    return false
  }

  const prefix = pathPrefix.replace(/^\/+|\/+$/gu, '')

  return prefix === '' || path === prefix || path.startsWith(`${prefix}/`)
}

/** GET /api/credentials answer */
export interface AccessCredentialsResponse {
  enabled: boolean // false without SIEB_CREDENTIALS_KEY: credentials cannot be stored or used
  fetcherConfigured: boolean // false without SIEB_FETCHER_SECRET: private pulls and clones are off
  credentials: AccessCredentialView[]
}

/** How Auto-check can reach one image, shown per image in the finding detail */
export interface ImageCheckAccess {
  imageRef: string
  level: 'public' | 'credential' | 'none' // public registry, a stored registry credential, or no access
  credentialId: number | null // registry credential that covers the image
  credentialLabel: string | null
}
