import type { AccessCredentialsResponse, AccessCredentialView } from '#core/privateAccess.ts'

/**
 * Returns the answer with one credential replaced, or appended when it is new.
 * @param {AccessCredentialsResponse} response - Current answer
 * @param {AccessCredentialView} next - Credential as the server answered it
 * @returns {AccessCredentialsResponse} - Answer with the credential
 */
export const withCredential = (
  response: AccessCredentialsResponse,
  next: AccessCredentialView,
): AccessCredentialsResponse => {
  const known = response.credentials.some((credential) => credential.id === next.id)

  return {
    ...response,
    credentials: known
      ? response.credentials.map((credential) => (credential.id === next.id ? next : credential))
      : [...response.credentials, next],
  }
}

/**
 * Returns the answer without one credential.
 * @param {AccessCredentialsResponse} response - Current answer
 * @param {number} id - Credential id
 * @returns {AccessCredentialsResponse} - Answer without the credential
 */
export const withoutCredential = (
  response: AccessCredentialsResponse,
  id: number,
): AccessCredentialsResponse => ({
  ...response,
  credentials: response.credentials.filter((credential) => credential.id !== id),
})
