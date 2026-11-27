import type {
  AccessCredentialsResponse,
  AccessCredentialView,
  AccessTestResult,
} from '#core/privateAccess.ts'

/**
 * Builds a GitLab credential for registry and git on your-group/.
 * @param {Partial<AccessCredentialView>} overrides - Fields to set
 * @returns {AccessCredentialView} - Credential
 */
export const buildCredential = (
  overrides: Partial<AccessCredentialView> = {},
): AccessCredentialView => ({
  id: 1,
  provider: 'gitlab',
  label: 'GitLab your-group',
  uses: ['registry', 'git'],
  registryHost: 'registry.gitlab.com',
  gitHost: 'gitlab.com',
  pathPrefix: 'your-group/',
  repoMapping: null,
  username: 'gitlab+deploy-token-12',
  createdBy: 'alice',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  lastUsedAt: null,
  lastTest: null,
  ...overrides,
})

/**
 * Builds a credentials answer, enabled with the fetcher configured and no credentials.
 * @param {Partial<AccessCredentialsResponse>} overrides - Fields to set
 * @returns {AccessCredentialsResponse} - Answer
 */
export const buildCredentialsResponse = (
  overrides: Partial<AccessCredentialsResponse> = {},
): AccessCredentialsResponse => ({
  enabled: true,
  fetcherConfigured: true,
  credentials: [],
  ...overrides,
})

/**
 * Builds a test result with two reachable images and one repository that failed.
 * @param {Partial<AccessTestResult>} overrides - Fields to set
 * @returns {AccessTestResult} - Result
 */
export const buildTestResult = (overrides: Partial<AccessTestResult> = {}): AccessTestResult => ({
  at: '2026-11-27T09:00:00.000Z',
  registry: { checked: 2, ok: 2, failures: [] },
  git: {
    checked: 1,
    ok: 0,
    failures: [{ target: 'https://gitlab.com/your-group/shop', reason: '403 forbidden' }],
  },
  ...overrides,
})
