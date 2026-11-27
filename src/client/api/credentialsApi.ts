import type {
  AccessCredentialInput,
  AccessCredentialsResponse,
  AccessCredentialView,
} from '#core/privateAccess.ts'
import { apiRequest } from '@/api/apiRequest'

export const CREDENTIALS_URL = '/api/credentials'

/** PATCH /api/credentials/:id body, the secret only to replace it */
export type AccessCredentialPatch = Partial<Omit<AccessCredentialInput, 'secret'>> & {
  secret?: string
}

/**
 * Fetches the stored access credentials and whether they can be stored and used.
 * @returns {Promise<AccessCredentialsResponse>} - Switches and credentials, never their secrets
 */
export const fetchCredentials = (): Promise<AccessCredentialsResponse> =>
  apiRequest(CREDENTIALS_URL)

/**
 * Stores a new access credential.
 * @param {AccessCredentialInput} input - Provider, label, uses, hosts, prefix, mapping and secret
 * @returns {Promise<AccessCredentialView>} - Stored credential without its secret
 * @throws {ApiError} - 400 with validation errors, 409 duplicate_scope or too_many_credentials, 404 credentials_disabled
 */
export const createCredential = (input: AccessCredentialInput): Promise<AccessCredentialView> =>
  apiRequest(CREDENTIALS_URL, 'POST', input)

/**
 * Changes a stored access credential, replacing its secret only when one is given.
 * @param {number} id - Credential id
 * @param {AccessCredentialPatch} patch - Changed fields
 * @returns {Promise<AccessCredentialView>} - Changed credential without its secret
 * @throws {ApiError} - 400 with validation errors, 404 for unknown credentials, 409 duplicate_scope
 */
export const updateCredential = (
  id: number,
  patch: AccessCredentialPatch,
): Promise<AccessCredentialView> => apiRequest(`${CREDENTIALS_URL}/${id}`, 'PATCH', patch)

/**
 * Deletes a stored access credential.
 * @param {number} id - Credential id
 * @returns {Promise<void>}
 * @throws {ApiError} - 404 for unknown credentials
 */
export const deleteCredential = async (id: number): Promise<void> => {
  await apiRequest<unknown>(`${CREDENTIALS_URL}/${id}`, 'DELETE')
}

/**
 * Tests a stored credential against the images and repositories it covers.
 * @param {number} id - Credential id
 * @returns {Promise<AccessCredentialView>} - Credential with the result as its last test
 * @throws {ApiError} - 404 for unknown credentials, 409 secret_unreadable
 */
export const testCredential = (id: number): Promise<AccessCredentialView> =>
  apiRequest(`${CREDENTIALS_URL}/${id}/test`, 'POST', {})
