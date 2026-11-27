import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import { associatedData, type SealBinding } from '#server/credentials/sealBinding.ts'

/** What a credential holds besides its scope, only ever in memory */
export interface CredentialSecret {
  username: string | null
  secret: string
}

/** The sealed username and secret as stored in access_credentials */
export interface SealedSecret {
  ciphertext: Buffer // format version byte, AES-256-GCM ciphertext, then the 16-byte tag
  nonce: Buffer // 12 random bytes, fresh for every seal
  keyId: string // which key sealed it
}

/** Seals and opens credential secrets with SIEB_CREDENTIALS_KEY */
export interface CredentialVault {
  keyId: string // fingerprint of the key, stored with each row
  seal: (binding: SealBinding, plain: CredentialSecret) => SealedSecret
  open: (binding: SealBinding, sealed: SealedSecret) => CredentialSecret | null
}

export const SEAL_VERSION = 1
const NONCE_BYTES = 12
const TAG_BYTES = 16

/**
 * Parses the opened plain text of a seal.
 * @param {string} text - JSON text
 * @returns {CredentialSecret | null} - Username and secret, null for another shape
 */
const parsePlain = (text: string): CredentialSecret | null => {
  const parsed = JSON.parse(text) as { u?: unknown; s?: unknown }

  return typeof parsed.s === 'string' && (parsed.u === null || typeof parsed.u === 'string')
    ? { username: parsed.u, secret: parsed.s }
    : null
}

/**
 * Creates the vault over a 32-byte key. The key id is a truncated hash of the key, so rows
 * sealed with an earlier key are recognised as unreadable without trying them. Each seal starts
 * with SEAL_VERSION, which is also part of the associated data, so a later format can tell its
 * rows apart.
 * @param {Buffer} key - SIEB_CREDENTIALS_KEY
 * @returns {CredentialVault} - Vault
 */
export const createCredentialVault = (key: Buffer): CredentialVault => {
  const keyId = createHash('sha256')
    .update('sieb-credentials-key-id')
    .update(key)
    .digest('hex')
    .slice(0, 16)

  return {
    keyId,
    seal: (binding, plain) => {
      const nonce = randomBytes(NONCE_BYTES)
      const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES })

      cipher.setAAD(associatedData(SEAL_VERSION, binding))

      const body = Buffer.concat([
        cipher.update(JSON.stringify({ u: plain.username, s: plain.secret }), 'utf8'),
        cipher.final(),
      ])

      return {
        ciphertext: Buffer.concat([Buffer.of(SEAL_VERSION), body, cipher.getAuthTag()]),
        nonce,
        keyId,
      }
    },
    open: (binding, sealed) => {
      if (
        sealed.keyId !== keyId ||
        sealed.nonce.length !== NONCE_BYTES ||
        sealed.ciphertext.length <= 1 + TAG_BYTES ||
        sealed.ciphertext[0] !== SEAL_VERSION
      ) {
        return null
      }

      try {
        const decipher = createDecipheriv('aes-256-gcm', key, sealed.nonce, {
          authTagLength: TAG_BYTES,
        })

        decipher.setAAD(associatedData(SEAL_VERSION, binding))
        decipher.setAuthTag(sealed.ciphertext.subarray(-TAG_BYTES))

        return parsePlain(
          Buffer.concat([
            decipher.update(sealed.ciphertext.subarray(1, -TAG_BYTES)),
            decipher.final(),
          ]).toString('utf8'),
        )
      } catch {
        return null
      }
    },
  }
}
