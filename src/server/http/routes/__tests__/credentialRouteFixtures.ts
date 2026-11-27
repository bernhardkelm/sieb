import type { DatabaseSync } from 'node:sqlite'

import type { AccessCredentialView } from '#core/privateAccess.ts'
import { testVault } from '#server/credentials/__tests__/credentialFixtures.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { buildSnapshot } from '#server/db/__tests__/dbFixtures.ts'
import { testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp, type AppDeps } from '#server/http/createApp.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

export const ALICE = { 'X-authentik-username': 'alice' }
export const GITHUB_INPUT = {
  provider: 'github',
  label: 'GitHub',
  uses: ['git'],
  pathPrefix: 'acme',
  secret: 'ghp_abcdef0123456789',
}
export const ADVERTISEMENT = { 'content-type': 'application/x-git-upload-pack-advertisement' }

/**
 * Answers 200 for every manifest and the refs advertisement for every repository.
 * @param {string | URL | Request} input - Request URL
 * @returns {Promise<Response>} - Answer
 */
export const reachableFetch = (async (input: string | URL | Request) =>
  String(input).includes('/info/refs')
    ? new Response('001e# service=git-upload-pack\n', { headers: ADVERTISEMENT })
    : new Response(null, { status: 200 })) as typeof globalThis.fetch

/**
 * Seeds findings on images of the GitLab fixture credential, which its mapping turns into
 * gitlab.example.com/acme/shop and /lib, and one on another registry.
 * @param {DatabaseSync} db - Database
 * @returns {void}
 */
export const seedCredentialImages = (db: DatabaseSync): void => {
  applySnapshot(
    db,
    buildSnapshot([
      { imageRef: 'registry.example.com/acme/shop', imageTag: '1.0' },
      { imageRef: 'registry.example.com/acme/lib', imageTag: '2.0' },
      { imageRef: 'registry.other.example/acme/shop', imageTag: '1.0' },
    ]),
    new Date('2026-06-01T12:00:00.000Z'),
  )
}

/**
 * Creates an app without a dev user over the test vault and seeded images, collecting its log.
 * @param {{ vault?: CredentialVault | null; fetch?: typeof globalThis.fetch; testLimits?: { cooldownMs?: number; maxRunning?: number } } & Partial<AppDeps>} overrides - Vault, fetch, test limits and dependencies to replace
 * @returns {{ app: ReturnType<typeof createApp>; logs: string[]; deps: AppDeps; vault: CredentialVault | null }} - App, log, dependencies and vault
 */
export const credentialApp = ({
  vault = testVault(),
  fetch = reachableFetch,
  testLimits = { cooldownMs: 0 },
  ...overrides
}: {
  vault?: CredentialVault | null
  fetch?: typeof globalThis.fetch
  testLimits?: { cooldownMs?: number; maxRunning?: number }
} & Partial<AppDeps> = {}) => {
  const logs: string[] = []
  const deps = testAppDeps({
    devUser: null,
    log: (line) => logs.push(line),
    credentials: { vault, fetch, timings: { requestMs: 50, totalMs: 500 }, testLimits },
    ...overrides,
  })

  seedCredentialImages(deps.db)
  return { app: createApp(deps), logs, deps, vault }
}

/**
 * Sends a request as alice and returns status, parsed body and raw text.
 * @param {ReturnType<typeof createApp>} app - App
 * @param {string} path - Path
 * @param {string} method - Method
 * @param {unknown} body - JSON body
 * @returns {Promise<{ status: number; body: T; text: string }>} - Answer
 */
export const send = async <T = AccessCredentialView>(
  app: ReturnType<typeof createApp>,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<{ status: number; body: T; text: string }> => {
  const response = await app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...ALICE },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()

  return { status: response.status, body: (text === '' ? null : JSON.parse(text)) as T, text }
}
