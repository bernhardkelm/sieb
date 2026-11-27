import {
  PROVIDER_SPECS,
  type AccessCredentialInput,
  type AccessCredentialView,
  type AccessProvider,
  type AccessUse,
  type RepoMapping,
} from '#core/privateAccess.ts'
import type { AccessCredentialPatch } from '@/api/credentialsApi'

/** Values of the add and edit form, strings as typed */
export interface CredentialFormModel {
  provider: AccessProvider
  label: string
  uses: AccessUse[]
  registryHost: string
  gitHost: string
  pathPrefix: string
  registryPrefix: string
  repoPrefix: string
  username: string
  secret: string
}

/**
 * Returns the empty form for a provider, with its uses and default hosts.
 * @param {AccessProvider} provider - Provider
 * @returns {CredentialFormModel} - Form values
 */
export const newCredentialModel = (provider: AccessProvider): CredentialFormModel => {
  const spec = PROVIDER_SPECS[provider]

  return {
    provider,
    label: '',
    uses: [...spec.uses],
    registryHost: spec.registryHost ?? '',
    gitHost: spec.gitHost ?? '',
    pathPrefix: '',
    registryPrefix: '',
    repoPrefix: '',
    username: '',
    secret: '',
  }
}

/**
 * Returns the form values of a stored credential for editing, the secret always empty.
 * @param {AccessCredentialView} credential - Stored credential
 * @returns {CredentialFormModel} - Form values
 */
export const credentialModelOf = (credential: AccessCredentialView): CredentialFormModel => ({
  provider: credential.provider,
  label: credential.label,
  uses: [...credential.uses],
  registryHost: credential.registryHost ?? '',
  gitHost: credential.gitHost ?? '',
  pathPrefix: credential.pathPrefix,
  registryPrefix: credential.repoMapping?.registryPrefix ?? '',
  repoPrefix: credential.repoMapping?.repoPrefix ?? '',
  username: credential.username ?? '',
  secret: '',
})

/**
 * Returns the repository mapping of the form, null while both prefixes are empty.
 * @param {CredentialFormModel} model - Form values
 * @returns {RepoMapping | null} - Mapping
 */
const mappingOf = (model: CredentialFormModel): RepoMapping | null => {
  const registryPrefix = model.registryPrefix.trim()
  const repoPrefix = model.repoPrefix.trim()

  return registryPrefix === '' && repoPrefix === '' ? null : { registryPrefix, repoPrefix }
}

/**
 * Returns the username to send, null for providers whose token needs none.
 * @param {CredentialFormModel} model - Form values
 * @returns {string | null} - Username
 */
const usernameOf = (model: CredentialFormModel): string | null =>
  PROVIDER_SPECS[model.provider].needsUsername ? model.username.trim() : null

/**
 * Returns the host of a use to send: the typed one for self-hosted providers while the use is
 * chosen, null when it is not, and nothing for providers with fixed hosts.
 * @param {CredentialFormModel} model - Form values
 * @param {AccessUse} use - Use the host serves
 * @param {string} host - Typed host
 * @returns {string | null | undefined} - Host, undefined to keep the provider default
 */
const hostOf = (
  model: CredentialFormModel,
  use: AccessUse,
  host: string,
): string | null | undefined => {
  if (!PROVIDER_SPECS[model.provider].customHost) {
    return undefined
  }

  return model.uses.includes(use) ? host.trim() : null
}

/**
 * Builds the POST body of a new credential.
 * @param {CredentialFormModel} model - Form values
 * @returns {AccessCredentialInput} - Body
 */
export const credentialInputOf = (model: CredentialFormModel): AccessCredentialInput => {
  const input: AccessCredentialInput = {
    provider: model.provider,
    label: model.label.trim(),
    uses: [...model.uses],
    pathPrefix: model.pathPrefix.trim(),
    repoMapping: mappingOf(model),
    username: usernameOf(model),
    secret: model.secret.trim(),
  }
  const registryHost = hostOf(model, 'registry', model.registryHost)
  const gitHost = hostOf(model, 'git', model.gitHost)

  if (registryHost !== undefined) {
    input.registryHost = registryHost
  }

  if (gitHost !== undefined) {
    input.gitHost = gitHost
  }

  return input
}

/**
 * Builds the PATCH body of an edited credential: label, prefix, mapping and username, the
 * secret only when a new one was typed.
 * @param {CredentialFormModel} model - Form values
 * @returns {AccessCredentialPatch} - Body
 */
export const credentialPatchOf = (model: CredentialFormModel): AccessCredentialPatch => {
  const secret = model.secret.trim()
  const patch: AccessCredentialPatch = {
    label: model.label.trim(),
    pathPrefix: model.pathPrefix.trim(),
    repoMapping: mappingOf(model),
    username: usernameOf(model),
  }

  if (secret !== '') {
    patch.secret = secret
  }

  return patch
}
