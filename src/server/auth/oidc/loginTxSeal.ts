import { randomBytes } from 'node:crypto'

import { EncryptJWT, jwtDecrypt } from 'jose'

import type { Clock } from '#core/clock.ts'

export const LOGIN_TX_TTL_MS = 10 * 60 * 1000

const KEY_BYTES = 32

/** What the callback of one login needs back, carried sealed in the login cookie */
export interface LoginTx {
  state: string
  nonce: string
  codeVerifier: string
  returnTo: string // validated relative path
}

/** An opened login cookie with the end of its validity */
export interface OpenedLoginTx extends LoginTx {
  expiresAtMs: number
}

export interface LoginTxSeal {
  seal: (tx: LoginTx) => Promise<string>
  open: (sealed: string) => Promise<OpenedLoginTx | null>
}

/**
 * Returns whether a decrypted payload has the shape of a pending login.
 * @param {Record<string, unknown>} payload - Decrypted claims
 * @returns {boolean} - True when every field is a string
 */
const isLoginTx = (payload: Record<string, unknown>): boolean =>
  ['state', 'nonce', 'codeVerifier', 'returnTo'].every((key) => typeof payload[key] === 'string')

/**
 * Creates the sealer of pending logins: state, nonce, PKCE verifier and return path are
 * encrypted (dir, A256GCM) with a random key made at process start into the login cookie, valid
 * LOGIN_TX_TTL_MS. Nothing is stored server side, so a login flood costs no memory and evicts
 * nobody; a restart invalidates pending logins. The callback clears the cookie and records the
 * state as consumed until the seal expires, so each cookie works once.
 * @param {{ clock: Clock; key?: Uint8Array }} options - Clock, key for tests
 * @returns {LoginTxSeal} - Sealer
 */
export const createLoginTxSeal = ({
  clock,
  key = new Uint8Array(randomBytes(KEY_BYTES)),
}: {
  clock: Clock
  key?: Uint8Array
}): LoginTxSeal => ({
  seal: ({ state, nonce, codeVerifier, returnTo }) => {
    const now = Math.floor(clock().getTime() / 1000)

    return new EncryptJWT({ state, nonce, codeVerifier, returnTo })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt(now)
      .setExpirationTime(now + LOGIN_TX_TTL_MS / 1000)
      .encrypt(key)
  },
  open: async (sealed) => {
    try {
      const { payload } = await jwtDecrypt(sealed, key, {
        keyManagementAlgorithms: ['dir'],
        contentEncryptionAlgorithms: ['A256GCM'],
        requiredClaims: ['iat', 'exp'],
        currentDate: clock(),
      })

      if (!isLoginTx(payload)) {
        return null
      }

      const { state, nonce, codeVerifier, returnTo } = payload as unknown as LoginTx
      return { state, nonce, codeVerifier, returnTo, expiresAtMs: Number(payload.exp) * 1000 }
    } catch {
      return null
    }
  },
})
