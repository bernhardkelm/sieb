import { randomBytes } from 'node:crypto'

import { validateCredentialInput } from '#core/credentialInputValidation.ts'
import type { AccessTestResult } from '#core/privateAccess.ts'
import { createCredential } from '#server/credentials/credentialCommands.ts'
import { createCredentialVault } from '#server/credentials/credentialVault.ts'
import { touchCredential } from '#server/db/credentialRepository.ts'
import { openDatabase } from '#server/db/openDatabase.ts'

const MINUTE_MS = 60_000

interface CredentialSeed {
  input: Record<string, unknown>
  createdBy: string
  test: Omit<AccessTestResult, 'at'>
  testedMinutesAgo: number
  usedMinutesAgo: number | null
}

/**
 * Returns the example credentials: one passed, one saved without a test, one with a failure.
 * @param {string} user - Signed-in user
 * @param {string} otherUser - Second user of the seed
 * @returns {CredentialSeed[]} - Seeds in creation order
 */
const credentialSeeds = (user: string, otherUser: string): CredentialSeed[] => [
  {
    input: {
      provider: 'github',
      label: 'acme packages',
      uses: ['registry'],
      pathPrefix: 'acme/',
    },
    createdBy: user,
    test: { registry: { checked: 3, ok: 3, failures: [], denied: 0, blocked: 0 }, git: null },
    testedMinutesAgo: 26 * 60,
    usedMinutesAgo: 140,
  },
  {
    input: {
      provider: 'gitlab',
      label: 'acme group',
      uses: ['registry', 'git'],
      registryHost: 'registry.example.com',
      gitHost: 'gitlab.example.com',
      pathPrefix: 'acme/',
      username: 'gitlab+deploy-token-7',
    },
    createdBy: otherUser,
    test: {
      registry: { checked: 2, ok: 0, failures: [], denied: 0, blocked: 2 },
      git: { checked: 2, ok: 0, failures: [], denied: 0, blocked: 2 },
      untested: true,
    },
    testedMinutesAgo: 3 * 24 * 60,
    usedMinutesAgo: 35,
  },
  {
    input: {
      provider: 'dockerhub',
      label: 'acme hub',
      uses: ['registry'],
      pathPrefix: 'acme/',
      username: 'acmebot',
    },
    createdBy: user,
    test: {
      registry: {
        checked: 2,
        ok: 1,
        failures: [{ target: 'docker.io/acme/legacy-api', reason: 'not found' }],
        denied: 0,
        blocked: 0,
      },
      git: null,
    },
    testedMinutesAgo: 50,
    usedMinutesAgo: null,
  },
]

/**
 * Returns the time a number of minutes before now.
 * @param {Date} now - Reference time
 * @param {number} minutes - Minutes back
 * @returns {Date} - Earlier time
 */
const minutesBefore = (now: Date, minutes: number): Date =>
  new Date(now.getTime() - minutes * MINUTE_MS)

/**
 * Stores the example access credentials through the server's own validation and command, with a
 * test result and a last use each, before sieb starts. A real test would reach out to the
 * registry and git hosts, so the result is written as seed data instead.
 * @param {string} dbPath - Database file of the sandbox
 * @param {Buffer} key - SIEB_CREDENTIALS_KEY of the sandbox
 * @param {{ user: string; otherUser: string }} users - Signed-in user and second user
 * @returns {void}
 * @throws {Error} - When a seed credential is invalid or refused
 */
export const seedCredentials = (
  dbPath: string,
  key: Buffer,
  { user, otherUser }: { user: string; otherUser: string },
): void => {
  const db = openDatabase(dbPath)
  const vault = createCredentialVault(key)
  const now = new Date()

  try {
    for (const seed of credentialSeeds(user, otherUser)) {
      const label = String(seed.input.label)
      const write = validateCredentialInput(
        { ...seed.input, secret: randomBytes(20).toString('hex') },
        true,
      )

      if (!write.ok) {
        throw new Error(`seed credential ${label}: ${JSON.stringify(write.errors)}`)
      }

      const at = minutesBefore(now, seed.testedMinutesAgo).toISOString()
      const lastTest = { ...seed.test, at }
      const result = createCredential(
        db,
        vault,
        { write: write.value, actor: seed.createdBy, lastTest },
        minutesBefore(now, seed.testedMinutesAgo + 5),
      )

      if (!result.ok) {
        throw new Error(`seed credential ${label}: ${result.error}`)
      }

      if (seed.usedMinutesAgo !== null) {
        touchCredential(db, result.row.id, minutesBefore(now, seed.usedMinutesAgo))
      }
    }
  } finally {
    db.close()
  }
}
