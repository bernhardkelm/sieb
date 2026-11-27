import { PROVIDER_SPECS, type AccessUse } from '#core/privateAccess.ts'
import type { CredentialFormModel } from '@/components/access/credentialFormModel'

/**
 * Returns the uses of the form with one added or removed, in the order of the provider's uses.
 * @param {CredentialFormModel} model - Form values
 * @param {AccessUse} use - Use
 * @param {boolean} on - Whether it is chosen
 * @returns {AccessUse[]} - Chosen uses
 */
export const withUse = (model: CredentialFormModel, use: AccessUse, on: boolean): AccessUse[] => {
  const chosen = on ? [...model.uses, use] : model.uses.filter((item) => item !== use)

  return PROVIDER_SPECS[model.provider].uses.filter((item) => chosen.includes(item))
}
