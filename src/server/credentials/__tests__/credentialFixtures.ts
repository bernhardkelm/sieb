import type { DatabaseSync } from 'node:sqlite'

import { validateCredentialInput } from '#core/credentialInputValidation.ts'
import { createCredential } from '#server/credentials/credentialCommands.ts'
import { createCredentialVault, type CredentialVault } from '#server/credentials/credentialVault.ts'
import type { CredentialRow } from '#server/db/credentialRows.ts'

export const TEST_KEY = Buffer.alloc(32, 7)
export const OTHER_KEY = Buffer.alloc(32, 9)
export const GITLAB_SECRET = 'glpat-0123456789abcdefghij'
export const GITHUB_SECRET = 'ghp_0123456789abcdefghijklmnopqrstuv'

/** GitLab credential on a self-hosted instance with registry and git use */
export const GITLAB_INPUT = {
  provider: 'gitlab',
  label: 'Example GitLab',
  uses: ['registry', 'git'],
  registryHost: 'registry.example.com',
  gitHost: 'gitlab.example.com',
  pathPrefix: 'acme',
  repoMapping: {
    registryPrefix: 'registry.example.com/acme/',
    repoPrefix: 'gitlab.example.com/acme/',
  },
  username: 'deploy-bot',
  secret: GITLAB_SECRET,
}

/**
 * Creates the vault of the test key.
 * @param {Buffer} key - Key, TEST_KEY by default
 * @returns {CredentialVault} - Vault
 */
export const testVault = (key: Buffer = TEST_KEY): CredentialVault => createCredentialVault(key)

/**
 * Stores a credential through validation and the create command.
 * @param {DatabaseSync} db - Database
 * @param {CredentialVault} vault - Vault
 * @param {Record<string, unknown>} input - Request body, GITLAB_INPUT by default
 * @returns {CredentialRow} - Stored row
 * @throws {Error} - When the input is invalid or the create is refused
 */
export const storeCredential = (
  db: DatabaseSync,
  vault: CredentialVault,
  input: Record<string, unknown> = GITLAB_INPUT,
): CredentialRow => {
  const write = validateCredentialInput(input, true)

  if (!write.ok) {
    throw new Error(`invalid credential: ${JSON.stringify(write.errors)}`)
  }

  const result = createCredential(
    db,
    vault,
    { write: write.value, actor: 'alice', lastTest: null },
    new Date('2026-06-01T12:00:00.000Z'),
  )

  if (!result.ok) {
    throw new Error(`credential refused: ${result.error}`)
  }

  return result.row
}
