import { readSecretSetting, type ReadSecretFile } from '#server/secretSetting.ts'

export const CREDENTIALS_KEY_BYTES = 32

const BASE64 = /^[A-Za-z0-9+/]{43}=$|^[A-Za-z0-9_-]{43}$/u

/**
 * Reads the key that seals stored access credentials from SIEB_CREDENTIALS_KEY or
 * SIEB_CREDENTIALS_KEY_FILE: 32 bytes in base64 or base64url. A missing key turns private
 * access off; a malformed one refuses to start, so a typo never silently disables it.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {ReadSecretFile} readFile - Reads the key file
 * @returns {Buffer | null} - Key, null when unset
 * @throws {Error} - For a malformed key, never with the key in the message
 */
export const readCredentialsKey = (
  env: Record<string, string | undefined>,
  readFile?: ReadSecretFile,
): Buffer | null => {
  const text = readSecretSetting(env, 'SIEB_CREDENTIALS_KEY', readFile)

  if (text === null) {
    return null
  }

  const key = BASE64.test(text)
    ? Buffer.from(text, text.includes('=') ? 'base64' : 'base64url')
    : null

  if (key === null || key.length !== CREDENTIALS_KEY_BYTES) {
    throw new Error(
      `SIEB_CREDENTIALS_KEY must be ${CREDENTIALS_KEY_BYTES} bytes in base64, for example from openssl rand -base64 32`,
    )
  }

  return key
}
