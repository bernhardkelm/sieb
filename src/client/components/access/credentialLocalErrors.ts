import { PROVIDER_SPECS } from '#core/privateAccess.ts'
import {
  noCredentialErrors,
  type CredentialFormErrors,
} from '@/components/access/credentialFormErrors'
import type { CredentialFormModel } from '@/components/access/credentialFormModel'

/**
 * Checks the form before it is sent: label, at least one use, the hosts of a self-hosted
 * provider, the username where the token needs one, both mapping prefixes or neither, and the
 * token when adding.
 * @param {CredentialFormModel} model - Form values
 * @param {boolean} editing - Whether a stored credential is edited, the token is optional then
 * @returns {CredentialFormErrors} - Messages per field, all empty when the form passes
 */
export const localCredentialErrors = (
  model: CredentialFormModel,
  editing: boolean,
): CredentialFormErrors => {
  const errors = noCredentialErrors()
  const spec = PROVIDER_SPECS[model.provider]
  const blank = (value: string): boolean => value.trim() === ''

  if (blank(model.label)) {
    errors.label.push('A label is required.')
  }

  if (model.uses.length === 0) {
    errors.uses.push('Choose at least one use.')
  }

  if (spec.customHost && model.uses.includes('registry') && blank(model.registryHost)) {
    errors.registryHost.push('A registry host is required.')
  }

  if (spec.customHost && model.uses.includes('git') && blank(model.gitHost)) {
    errors.gitHost.push('A git host is required.')
  }

  if (spec.needsUsername && blank(model.username)) {
    errors.username.push('This token needs its username.')
  }

  if (blank(model.registryPrefix) !== blank(model.repoPrefix)) {
    errors.repoMapping.push('Fill in both prefixes, or leave both empty.')
  }

  if (!editing && blank(model.secret)) {
    errors.secret.push('The token is required.')
  }

  return errors
}

/**
 * Returns whether any field has a message.
 * @param {CredentialFormErrors} errors - Messages per field
 * @returns {boolean} - True when some message exists
 */
export const hasCredentialErrors = (errors: CredentialFormErrors): boolean =>
  Object.values(errors).some((messages) => messages.length > 0)
