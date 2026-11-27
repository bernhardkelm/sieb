import { basicAuth } from '#checker/fetcher/basicAuth.ts'
import { redactTokens } from '#checker/fetcher/redactTokens.ts'

const MASK = '[redacted]'

/** The credentials of one check, so no error text or log line repeats them */
export interface SecretList {
  add: (username: string, secret: string) => void
  redact: (text: string) => string
}

/**
 * Creates an empty secret list; each login adds its secret and its basic auth form, and redact
 * also masks tokens the list never saw, such as those a registry issued.
 * @returns {SecretList} - Add and redact calls
 */
export const createSecretList = (): SecretList => {
  const secrets = new Set<string>()

  return {
    add: (username, secret) => {
      secrets.add(secret)
      secrets.add(basicAuth(username, secret))
    },
    redact: (text) => {
      let clean = text

      for (const secret of secrets) {
        clean = clean.split(secret).join(MASK)
      }

      return redactTokens(clean)
    },
  }
}
