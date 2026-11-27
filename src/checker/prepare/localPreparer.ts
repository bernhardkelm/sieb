import { claimImages } from '#checker/api/claimImages.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import type { WorkspacePreparer } from '#checker/prepare/prepareTypes.ts'
import { prepareWorkspace } from '#checker/workspace/prepareWorkspace.ts'
import { resolveImages } from '#checker/workspace/resolveImage.ts'

// registry answers of crane for a pull that needs a login
const NEEDS_CREDENTIAL = /\b(UNAUTHORIZED|DENIED|401|403)\b|authentication required/i

/** Prefix of a pull failure that needs a credential in single-container mode */
export const CREDENTIAL_HINT =
  'the image needs a registry credential, which only the fetcher container uses (SIEB_FETCHER_URL)'

/**
 * Runs a pull step and names the missing fetcher when the registry refused an anonymous pull.
 * @param {() => Promise<T>} step - Pull step
 * @returns {Promise<T>} - Result of the step
 * @throws {CheckFailure} - The step's failure, prefixed with CREDENTIAL_HINT for a refused login
 */
const withCredentialHint = async <T>(step: () => Promise<T>): Promise<T> => {
  try {
    return await step()
  } catch (error) {
    if (error instanceof CheckFailure && NEEDS_CREDENTIAL.test(error.message)) {
      throw new CheckFailure(`${CREDENTIAL_HINT}: ${error.message}`)
    }

    throw error
  }
}

/**
 * Single-container mode as in 0.5: the checker pulls the images anonymously into its own
 * workspace and checks out no source. The workspace lies in the check directory, which runCheck
 * wipes, so release has nothing to do.
 */
export const localPreparer: WorkspacePreparer = {
  prepare: async (claim, layout, context, onPulled) => {
    const resolved = await withCredentialHint(() =>
      resolveImages(claimImages(claim), layout, context),
    )

    const images = await withCredentialHint(() =>
      prepareWorkspace(claim.checkId, resolved, layout, context, onPulled),
    )

    return { images, source: { missing: 'no_fetcher' } }
  },
  release: async () => undefined,
}
