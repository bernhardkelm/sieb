import type { AccessCredentialView } from '#core/privateAccess.ts'
import {
  credentialModelOf,
  credentialPatchOf,
  type CredentialFormModel,
} from '@/components/access/credentialFormModel'

/**
 * Returns whether saving the form runs the credential test first: always for a new
 * credential, for an edit unless only the label changed and no token was typed.
 * @param {AccessCredentialView | null} credential - Edited credential, null while adding one
 * @param {CredentialFormModel} model - Form values
 * @returns {boolean} - True when the save is tested
 */
export const saveIsTested = (
  credential: AccessCredentialView | null,
  model: CredentialFormModel,
): boolean => {
  if (credential === null || model.secret.trim() !== '') {
    return true
  }

  const { label: _changed, ...changed } = credentialPatchOf(model)
  const { label: _stored, ...stored } = credentialPatchOf(credentialModelOf(credential))

  return JSON.stringify(changed) !== JSON.stringify(stored)
}
