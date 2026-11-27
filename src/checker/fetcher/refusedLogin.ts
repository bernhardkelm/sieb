import { normalizeHost, type RegistryAuth } from '#core/privateAccess.ts'
import { registryOf } from '#core/sourceAccess.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'

// registry answers of crane when it refused the login it was given
const REFUSED = /\b(UNAUTHORIZED|401)\b|authentication required/i

/**
 * Runs the pull of the primary image and names the credential whose login its registry refused,
 * by label and never with the login itself.
 * @param {RegistryAuth[]} registries - Logins of the check
 * @param {string} imageRef - Image ref of the primary image
 * @param {() => Promise<T>} step - Pull step
 * @returns {Promise<T>} - Result of the step
 * @throws {CheckFailure} - The step's failure, prefixed with the credential for a refused login
 */
export const withRefusedLogin = async <T>(
  registries: RegistryAuth[],
  imageRef: string,
  step: () => Promise<T>,
): Promise<T> => {
  try {
    return await step()
  } catch (error) {
    const host = registryOf(imageRef)
    const login = registries.find(
      (auth) => host !== null && normalizeHost(auth.host) === normalizeHost(host),
    )

    if (error instanceof CheckFailure && login !== undefined && REFUSED.test(error.message)) {
      const credential =
        login.label === undefined
          ? `the credential for ${login.host}`
          : `credential '${login.label}'`

      throw new CheckFailure(`the registry refused the login of ${credential}: ${error.message}`)
    }

    throw error
  }
}
