import { computed, nextTick, onMounted, shallowRef, type ComputedRef, type Ref } from 'vue'

import type { AccessCredentialView } from '#core/privateAccess.ts'
import { credentialErrorMessage } from '@/components/access/credentialFormErrors'
import {
  credentialInputOf,
  credentialPatchOf,
  type CredentialFormModel,
} from '@/components/access/credentialFormModel'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { testFailed, testSummaryText } from '@/format/accessText'
import { useCredentialsStore } from '@/stores/credentialsStore'
import { notifyError, notifyNotice, notifySuccess } from '@/toast/toastManager'

export interface AccessPage {
  /** Whether the add or edit form shows */
  formOpen: ComputedRef<boolean>
  /** Credential the form edits, null while it adds one */
  formCredential: ComputedRef<AccessCredentialView | null>
  openAdd: () => void
  openEdit: (credential: AccessCredentialView) => void
  /** Closes the form and returns focus to where it was opened */
  closeForm: () => void
  /** Adds or changes the credential of the form, rejects with the server error */
  save: (model: CredentialFormModel) => Promise<void>
  /** Tests a credential and names the outcome in a toast */
  test: (credential: AccessCredentialView) => Promise<void>
  confirmOpen: Ref<boolean>
  deleteTarget: Readonly<Ref<AccessCredentialView | null>>
  deleting: Readonly<Ref<boolean>>
  askDelete: (credential: AccessCredentialView) => void
  confirmDelete: () => Promise<void>
}

/**
 * Focuses the list item of a credential once it rendered.
 * @param {number} id - Credential id
 * @returns {Promise<void>}
 */
const focusItem = async (id: number): Promise<void> => {
  await nextTick()
  document.querySelector<HTMLElement>(`[data-credential-id="${id}"]`)?.focus()
}

/**
 * Drives the Access page: loads the credentials, opens the add and edit form, saves, tests and
 * deletes credentials, each with a toast, a delete only after a confirmation.
 * @returns {AccessPage} - Form, test and delete state and actions
 */
export const useAccessPage = (): AccessPage => {
  const store = useCredentialsStore()
  const target = shallowRef<AccessCredentialView | 'new' | null>(null)
  let opener: HTMLElement | null = null

  const deletion = useConfirmAction<AccessCredentialView>(async (credential) => {
    try {
      await store.remove(credential.id)

      if (target.value !== 'new' && target.value?.id === credential.id) {
        target.value = null
      }

      notifySuccess('Credential deleted', credential.label)
    } catch (failure) {
      notifyError('Could not delete the credential', new Error(credentialErrorMessage(failure)))
    }
  })

  /**
   * Opens the form for a target and remembers the focused element to return to.
   * @param {AccessCredentialView | 'new'} next - Credential to edit, or new
   * @returns {void}
   */
  const open = (next: AccessCredentialView | 'new'): void => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    target.value = next
  }

  /**
   * Closes the form and focuses the element that opened it, if it still exists.
   * @returns {void}
   */
  const closeForm = (): void => {
    target.value = null
    void nextTick(() => {
      if (opener?.isConnected) {
        opener.focus()
      }
    })
  }

  /**
   * Adds or changes the credential of the form and focuses it in the list.
   * @param {CredentialFormModel} model - Form values
   * @returns {Promise<void>}
   * @throws {ApiError} - When the server refuses it, the form shows the errors
   */
  const save = async (model: CredentialFormModel): Promise<void> => {
    const current = target.value
    const saved =
      current === 'new' || current === null
        ? await store.create(credentialInputOf(model))
        : await store.update(current.id, credentialPatchOf(model))

    notifySuccess(current === 'new' ? 'Credential added' : 'Credential saved', saved.label)
    target.value = null
    await focusItem(saved.id)
  }

  /**
   * Tests a credential and names the outcome.
   * @param {AccessCredentialView} credential - Credential
   * @returns {Promise<void>}
   */
  const test = async (credential: AccessCredentialView): Promise<void> => {
    try {
      const result = await store.test(credential.id)

      if (result === null) {
        return
      }

      if (testFailed(result)) {
        notifyNotice(`${credential.label}: not everything reachable`, testSummaryText(result))
      } else {
        notifySuccess(`${credential.label}: access works`, testSummaryText(result))
      }
    } catch (failure) {
      notifyError('Could not test the credential', new Error(credentialErrorMessage(failure)))
    }
  }

  onMounted(() => {
    void store.load()
  })

  return {
    formOpen: computed(() => target.value !== null),
    formCredential: computed(() => (target.value === 'new' ? null : target.value)),
    openAdd: () => open('new'),
    openEdit: (credential) => open(credential),
    closeForm,
    save,
    test,
    confirmOpen: deletion.open,
    deleteTarget: deletion.target,
    deleting: deletion.busy,
    askDelete: deletion.ask,
    confirmDelete: async () => {
      await deletion.confirm()
    },
  }
}
