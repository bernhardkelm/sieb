import type { RepositoryRef } from '#core/repositoryUrl.ts'
import type { CredentialLogin } from '#server/credentials/credentialLogin.ts'
import {
  basicAuth,
  discardBody,
  errorReason,
  probeRequest,
  statusReason,
  type ProbeOptions,
  type ProbeOutcome,
} from '#server/credentials/probe/probeFetch.ts'

/**
 * Asks a git host for the refs of a repository over smart HTTP with basic auth, the request
 * git clone starts with; only the advertisement content type counts as success.
 * @param {ProbeOptions} options - Probe options
 * @param {RepositoryRef} repository - Repository on the credential's git host
 * @param {CredentialLogin} auth - Username and secret
 * @returns {Promise<ProbeOutcome>} - null when the refs were readable, else a short reason
 */
export const probeGit = async (
  options: ProbeOptions,
  repository: RepositoryRef,
  auth: CredentialLogin,
): Promise<ProbeOutcome> => {
  try {
    const response = await probeRequest(
      options,
      `${repository.repoUrl}/info/refs?service=git-upload-pack`,
      {
        headers: {
          Authorization: basicAuth(auth.username, auth.secret),
          'User-Agent': 'git/2 (sieb)',
        },
      },
    )
    const type = response.headers.get('content-type') ?? ''

    await discardBody(response)

    if (response.status !== 200) {
      return statusReason(response.status)
    }

    return type.startsWith('application/x-git-upload-pack-advertisement')
      ? null
      : 'unexpected answer'
  } catch (error) {
    return errorReason(error)
  }
}
