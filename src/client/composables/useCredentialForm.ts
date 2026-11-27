import { computed, ref, type ComputedRef, type Ref } from 'vue'

import {
  PROVIDER_SPECS,
  type AccessCredentialView,
  type AccessProvider,
  type AccessUse,
} from '#core/privateAccess.ts'
import {
  credentialFormErrors,
  noCredentialErrors,
  type CredentialFormErrors,
} from '@/components/access/credentialFormErrors'
import {
  credentialModelOf,
  newCredentialModel,
  type CredentialFormModel,
} from '@/components/access/credentialFormModel'
import {
  hasCredentialErrors,
  localCredentialErrors,
} from '@/components/access/credentialLocalErrors'

export interface CredentialForm {
  model: Ref<CredentialFormModel>
  /** Whether a stored credential is edited */
  editing: boolean
  /** Messages per field: local ones after the first submit, the server's after a refused save */
  errors: ComputedRef<CredentialFormErrors>
  submitting: Ref<boolean>
  /** Switches the provider, resetting uses, hosts and username to its defaults */
  setProvider: (provider: AccessProvider) => void
  /** Adds or removes a use */
  setUse: (use: AccessUse, on: boolean) => void
  /** Checks and saves the form, resolves whether it was saved */
  submit: () => Promise<boolean>
}

/**
 * Merges the messages of two error sets field by field.
 * @param {CredentialFormErrors} first - Messages
 * @param {CredentialFormErrors} second - More messages
 * @returns {CredentialFormErrors} - Both
 */
const mergeErrors = (
  first: CredentialFormErrors,
  second: CredentialFormErrors,
): CredentialFormErrors => {
  const merged = noCredentialErrors()

  for (const field of Object.keys(merged) as (keyof CredentialFormErrors)[]) {
    merged[field] = [...first[field], ...second[field]]
  }

  return merged
}

/**
 * Holds the add or edit form of an access credential: its values, the local checks once
 * submitted, the server's validation errors per field and the save in flight. The token is
 * never prefilled and is cleared once saved.
 * @param {AccessCredentialView | null} credential - Credential to edit, null to add one
 * @param {(model: CredentialFormModel) => Promise<void>} save - Saves the values, rejects with the server error
 * @returns {CredentialForm} - Form state and actions
 */
export const useCredentialForm = (
  credential: AccessCredentialView | null,
  save: (model: CredentialFormModel) => Promise<void>,
): CredentialForm => {
  const editing = credential !== null
  const model = ref<CredentialFormModel>(
    credential === null ? newCredentialModel('github') : credentialModelOf(credential),
  )
  const submitted = ref(false)
  const submitting = ref(false)
  const serverErrors = ref<CredentialFormErrors>(noCredentialErrors())

  const errors = computed(() =>
    submitted.value
      ? mergeErrors(localCredentialErrors(model.value, editing), serverErrors.value)
      : serverErrors.value,
  )

  /**
   * Switches the provider and keeps label and prefix.
   * @param {AccessProvider} provider - Provider
   * @returns {void}
   */
  const setProvider = (provider: AccessProvider): void => {
    const { label, pathPrefix, secret } = model.value

    model.value = { ...newCredentialModel(provider), label, pathPrefix, secret }
    serverErrors.value = noCredentialErrors()
  }

  /**
   * Adds or removes a use, keeping the order of the provider's uses.
   * @param {AccessUse} use - Use
   * @param {boolean} on - Whether it is chosen
   * @returns {void}
   */
  const setUse = (use: AccessUse, on: boolean): void => {
    const chosen = on ? [...model.value.uses, use] : model.value.uses.filter((item) => item !== use)

    model.value.uses = PROVIDER_SPECS[model.value.provider].uses.filter((item) =>
      chosen.includes(item),
    )
  }

  /**
   * Checks the values and saves them unless a local check fails.
   * @returns {Promise<boolean>} - Whether the credential was saved
   */
  const submit = async (): Promise<boolean> => {
    if (submitting.value) {
      return false
    }

    submitted.value = true
    serverErrors.value = noCredentialErrors()

    if (hasCredentialErrors(localCredentialErrors(model.value, editing))) {
      return false
    }

    submitting.value = true

    try {
      await save(model.value)
      model.value.secret = ''
      return true
    } catch (error) {
      serverErrors.value = credentialFormErrors(error)
      return false
    } finally {
      submitting.value = false
    }
  }

  return { model, editing, errors, submitting, setProvider, setUse, submit }
}
