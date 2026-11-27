import type { ServerConfig } from '#server/config.ts'

/**
 * Describes at startup whether Auto-check can reach private images and source code, which needs
 * Auto-check, SIEB_CREDENTIALS_KEY and SIEB_FETCHER_SECRET together.
 * @param {Pick<ServerConfig, 'checks' | 'credentialsKey'>} config - Parsed configuration
 * @returns {string | null} - Log line, null while Auto-check is off
 */
export const privateAccessLine = ({
  checks,
  credentialsKey,
}: Pick<ServerConfig, 'checks' | 'credentialsKey'>): string | null => {
  if (checks === null) {
    return null
  }

  if (credentialsKey !== null && checks.fetcherSecret !== null) {
    return '[sieb] Auto-check private access on, stored credentials cover private images'
  }

  if (credentialsKey !== null) {
    return '[sieb] SIEB_CREDENTIALS_KEY set without SIEB_FETCHER_SECRET, Auto-check stays on public images'
  }

  return checks.fetcherSecret === null
    ? null
    : '[sieb] SIEB_FETCHER_SECRET set without SIEB_CREDENTIALS_KEY, no credentials can be stored'
}
