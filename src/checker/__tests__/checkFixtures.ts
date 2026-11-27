import type { WorkerClaim } from '#core/check.ts'
import type { CheckerConfig } from '#checker/checkerConfig.ts'
import type { PreparedCheck } from '#checker/prepare/prepareTypes.ts'
import type { WorkspaceImages } from '#checker/workspace/prepareWorkspace.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'

export const CLAIM: WorkerClaim = {
  checkId: 7,
  findingId: 42,
  vulnId: 'CVE-2099-0001',
  imageRef: 'docker.io/library/nginx:1.27',
  imageDigest: null,
  prompt: 'Investigate CVE-2099-0001 in docker.io/library/nginx:1.27.',
  mcpUrl: 'https://sieb.example.com/mcp',
  token: 'sieb_check_token',
  timeoutSeconds: 900,
  maxTurns: 40,
}

/**
 * Returns a worker configuration for tests.
 * @param {string} workdir - Work directory
 * @returns {CheckerConfig} - Configuration with recognizable secrets
 */
export const testConfig = (workdir: string): CheckerConfig => ({
  workerUrl: 'http://sieb:3101',
  workerSecret: 'worker-secret-value',
  credential: { kind: 'oauth_token', value: 'claude-oauth-token' },
  workdir,
  pollSeconds: 10,
  imageMaxBytes: 1024 * 1024,
  platform: 'linux/amd64',
  path: '/usr/bin:/bin',
  webDomains: ['nvd.nist.gov', '*.github.com'],
  model: null,
  effort: null,
  fetcher: null,
  sharedDir: '/shared',
})

/** The pulled image of CLAIM, resolved from its tag */
export const PULLED: PulledImage = {
  ref: `docker.io/library/nginx@sha256:${'a'.repeat(64)}`,
  digest: `sha256:${'a'.repeat(64)}`,
  scanned: false,
  tag: '1.27',
  claimRef: 'docker.io/library/nginx:1.27',
}

/** The workspace of CLAIM with its single image */
export const WORKSPACE: WorkspaceImages = {
  prepared: [{ ...PULLED, dir: 'images/1-1.27' }],
  skipped: [],
}

/** The prepared check of CLAIM in single-container mode */
export const PREPARED: PreparedCheck = { images: WORKSPACE, source: { missing: 'no_fetcher' } }
