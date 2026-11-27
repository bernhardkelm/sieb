import type { CredentialFields } from '#core/credentialInputValidation.ts'

/** What a sealed secret is bound to: its row and where the credential sends it */
export interface SealBinding {
  id: number
  provider: string
  registryHost: string | null
  gitHost: string | null
  pathPrefix: string
}

/**
 * Returns the binding of a credential's fields under its id.
 * @param {number} id - access_credentials id
 * @param {CredentialFields} fields - Fields the secret is sealed for
 * @returns {SealBinding} - Binding
 */
export const fieldsBinding = (id: number, fields: CredentialFields): SealBinding => ({
  id,
  provider: fields.provider,
  registryHost: fields.registryHost,
  gitHost: fields.gitHost,
  pathPrefix: fields.pathPrefix,
})

/**
 * Returns the associated data of a seal: format version, row id, provider, hosts and path
 * prefix, so a ciphertext copied into another row, or a row pointed at another provider, host
 * or prefix in the database, fails authentication.
 * @param {number} version - Seal format version
 * @param {SealBinding} binding - Row and scope the secret belongs to
 * @returns {Buffer} - Associated data
 */
export const associatedData = (version: number, binding: SealBinding): Buffer =>
  Buffer.from(
    JSON.stringify([
      'sieb:access_credentials',
      version,
      binding.id,
      binding.provider,
      binding.registryHost,
      binding.gitHost,
      binding.pathPrefix,
    ]),
  )
