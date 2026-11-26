import { readFileSync } from 'node:fs'

/**
 * Reads the sieb version from package.json, which the image ships next to src/.
 * @returns {string} - Version, 0.0.0 when package.json has none
 */
export const readAppVersion = (): string => {
  const raw: unknown = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  )
  const version = (raw as { version?: unknown }).version

  return typeof version === 'string' ? version : '0.0.0'
}
