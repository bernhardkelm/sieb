// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { OTHER_KEY, testVault } from '#server/credentials/__tests__/credentialFixtures.ts'
import { SEAL_VERSION } from '#server/credentials/credentialVault.ts'
import type { SealBinding } from '#server/credentials/sealBinding.ts'

const PLAIN = { username: 'deploy-bot', secret: 'glpat-0123456789abcdefghij' }
const BINDING: SealBinding = {
  id: 4,
  provider: 'gitlab',
  registryHost: 'registry.example.com',
  gitHost: 'gitlab.example.com',
  pathPrefix: 'acme',
}

describe('credential vault', () => {
  it('opens what it sealed for the same binding', () => {
    const vault = testVault()
    const sealed = vault.seal(BINDING, PLAIN)

    expect(vault.open(BINDING, sealed)).toEqual(PLAIN)
    expect(vault.open(BINDING, vault.seal(BINDING, { username: null, secret: 'x' }))).toEqual({
      username: null,
      secret: 'x',
    })
    expect(sealed.nonce).toHaveLength(12)
    expect(sealed.ciphertext[0]).toBe(SEAL_VERSION)
    expect(sealed.ciphertext.toString('utf8')).not.toContain(PLAIN.secret)
    expect(sealed.ciphertext.toString('utf8')).not.toContain(PLAIN.username)
  })

  it('uses a fresh nonce for every seal', () => {
    const vault = testVault()

    expect(vault.seal(BINDING, PLAIN).nonce.equals(vault.seal(BINDING, PLAIN).nonce)).toBe(false)
  })

  it('refuses a ciphertext of another row, a flipped bit, a changed nonce and another key', () => {
    const vault = testVault()
    const sealed = vault.seal(BINDING, PLAIN)
    const flipped = Buffer.from(sealed.ciphertext)
    const nonce = Buffer.from(sealed.nonce)

    flipped[1] = (flipped[1] ?? 0) ^ 1
    nonce[0] = (nonce[0] ?? 0) ^ 1

    expect(vault.open({ ...BINDING, id: 5 }, sealed)).toBeNull()
    expect(vault.open(BINDING, { ...sealed, ciphertext: flipped })).toBeNull()
    expect(vault.open(BINDING, { ...sealed, nonce })).toBeNull()
    expect(
      vault.open(BINDING, { ...sealed, ciphertext: sealed.ciphertext.subarray(0, 10) }),
    ).toBeNull()
    expect(testVault(OTHER_KEY).open(BINDING, sealed)).toBeNull()
    expect(
      testVault(OTHER_KEY).open(BINDING, { ...sealed, keyId: testVault(OTHER_KEY).keyId }),
    ).toBeNull()
  })

  it.each([
    ['provider', { provider: 'github' }],
    ['registry host', { registryHost: 'registry.attacker.example' }],
    ['registry host removed', { registryHost: null }],
    ['git host', { gitHost: 'git.attacker.example' }],
    ['git host removed', { gitHost: null }],
    ['path prefix', { pathPrefix: '' }],
  ])('refuses a seal whose %s changed', (_, change) => {
    const vault = testVault()

    expect(vault.open({ ...BINDING, ...change }, vault.seal(BINDING, PLAIN))).toBeNull()
  })

  it('refuses a seal of another format version', () => {
    const vault = testVault()
    const sealed = vault.seal(BINDING, PLAIN)
    const other = Buffer.from(sealed.ciphertext)

    other[0] = SEAL_VERSION + 1

    expect(vault.open(BINDING, { ...sealed, ciphertext: other })).toBeNull()
  })

  it('derives a stable key id that differs between keys and does not reveal the key', () => {
    expect(testVault().keyId).toBe(testVault().keyId)
    expect(testVault().keyId).not.toBe(testVault(OTHER_KEY).keyId)
    expect(testVault().keyId).toMatch(/^[0-9a-f]{16}$/)
  })
})
