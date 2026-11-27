import { computed, ref, type ComputedRef, type Ref } from 'vue'

import type {
  AccessCredentialView,
  AccessProvider,
  AccessTestResult,
  AccessUse,
} from '#core/privateAccess.ts'
import {
  credentialFormErrors,
  mergeCredentialErrors,
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
import { saveIsTested } from '@/components/access/credentialRetest'
import { withUse } from '@/components/access/credentialUses'
import {
  useCredentialTest,
  type CredentialTest,
  type CredentialTestPhase,
} from '@/composables/useCredentialTest'

/** Saves the form values, rejects with the server error */
export type SaveCredential = (model: CredentialFormModel, confirmUntested: boolean) => Promise<void>

/** Tests the form values without storing them */
export type TestCredentialValues = (model: CredentialFormModel) => Promise<AccessTestResult>

export interface CredentialForm {
  model: Ref<CredentialFormModel>
  /** Whether a stored credential is edited */
  editing: boolean
  /** Messages per field: local ones after the first submit, the server's after a refused save */
  errors: ComputedRef<CredentialFormErrors>
  submitting: Ref<boolean>
  /** Whether saving runs the credential test first */
  tested: ComputedRef<boolean>
  test: CredentialTest
  /** Switches the provider, resetting uses, hosts and username to its defaults */
  setProvider: (provider: AccessProvider) => void
  /** Adds or removes a use */
  setUse: (use: AccessUse, on: boolean) => void
  /** Checks, tests where needed and saves the form, resolves whether it was saved */
  submit: () => Promise<boolean>
  /** Checks and tests the form without saving, resolves whether the test ran */
  testOnly: () => Promise<boolean>
}

/**
 * Holds the add or edit form of an access credential: its values, the local checks once
 * submitted, the server's validation errors per field, the save or test in flight and the
 * last test. The token is never prefilled, stays in the field while a save is refused and is
 * cleared once saved.
 * @param {AccessCredentialView | null} credential - Credential to edit, null to add one
 * @param {SaveCredential} save - Saves the values, rejects with the server error
 * @param {TestCredentialValues} testValues - Tests the values without storing them
 * @returns {CredentialForm} - Form state and actions
 */
export const useCredentialForm = (
  credential: AccessCredentialView | null,
  save: SaveCredential,
  testValues: TestCredentialValues,
): CredentialForm => {
  const editing = credential !== null
  const model = ref<CredentialFormModel>(
    credential === null ? newCredentialModel('github') : credentialModelOf(credential),
  )
  const submitted = ref(false)
  const submitting = ref(false)
  const serverErrors = ref<CredentialFormErrors>(noCredentialErrors())
  const test = useCredentialTest()
  const tested = computed(() => saveIsTested(credential, model.value))

  const errors = computed(() =>
    submitted.value
      ? mergeCredentialErrors(localCredentialErrors(model.value, editing), serverErrors.value)
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
   * Checks the values and runs an action unless a local check fails; a save the test refused
   * shows its result, every other failure the server's messages.
   * @param {CredentialTestPhase | null} phase - Test the action runs, null for none
   * @param {() => Promise<void>} action - Save or test
   * @returns {Promise<boolean>} - Whether the action succeeded
   */
  const attempt = async (
    phase: CredentialTestPhase | null,
    action: () => Promise<void>,
  ): Promise<boolean> => {
    if (submitting.value) {
      return false
    }

    submitted.value = true
    serverErrors.value = noCredentialErrors()

    if (hasCredentialErrors(localCredentialErrors(model.value, editing))) {
      return false
    }

    submitting.value = true
    test.running.value = phase

    try {
      await action()
      return true
    } catch (error) {
      if (!test.recordRefusal(error)) {
        serverErrors.value = credentialFormErrors(error)
      }

      return false
    } finally {
      submitting.value = false
      test.running.value = null
    }
  }

  /**
   * Saves the values, after a test unless only the label changed.
   * @returns {Promise<boolean>} - Whether the credential was saved
   */
  const submit = (): Promise<boolean> =>
    attempt(tested.value ? 'save' : null, async () => {
      await save(model.value, test.confirmUntested.value)
      model.value.secret = ''
    })

  /**
   * Tests the values without saving them.
   * @returns {Promise<boolean>} - Whether the test ran
   */
  const testOnly = (): Promise<boolean> =>
    attempt('test', async () => {
      test.recordTest(await testValues(model.value))
    })

  return {
    model,
    editing,
    errors,
    submitting,
    tested,
    test,
    setProvider,
    setUse: (use, on) => {
      model.value.uses = withUse(model.value, use, on)
    },
    submit,
    testOnly,
  }
}
