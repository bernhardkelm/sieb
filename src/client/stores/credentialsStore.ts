import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type {
  AccessCredentialInput,
  AccessCredentialsResponse,
  AccessCredentialView,
  AccessTestResult,
} from '#core/privateAccess.ts'
import { ApiError } from '@/api/ApiError'
import { errorMessage } from '@/api/apiRequest'
import {
  createCredential,
  deleteCredential,
  fetchCredentials,
  testCredential,
  updateCredential,
  type AccessCredentialPatch,
} from '@/api/credentialsApi'
import { withCredential, withoutCredential } from '@/stores/credentialList'

/**
 * Holds the access credentials Auto-check pulls private images and clones source with, whether
 * the server can store them and whether the fetcher is configured. Secrets never reach the
 * client after they were sent; the list holds only what the API shows.
 */
export const useCredentialsStore = defineStore('credentials', () => {
  const response = shallowRef<AccessCredentialsResponse | null>(null)
  const error = ref<string | null>(null)
  const testing = ref<number[]>([])

  const loaded = computed(() => response.value !== null)
  const enabled = computed(() => response.value?.enabled === true)
  const fetcherConfigured = computed(() => response.value?.fetcherConfigured === true)
  const credentials = computed(() => response.value?.credentials ?? [])

  /**
   * Replaces or appends a credential in the stored answer.
   * @param {AccessCredentialView} next - Credential as the server answered it
   * @returns {void}
   */
  const upsert = (next: AccessCredentialView): void => {
    if (response.value !== null) {
      response.value = withCredential(response.value, next)
    }
  }

  /**
   * Fetches the credentials; a failure keeps the last answer and records the message.
   * @returns {Promise<void>}
   */
  const load = async (): Promise<void> => {
    try {
      response.value = await fetchCredentials()
      error.value = null
    } catch (failure) {
      error.value = errorMessage(failure)
    }
  }

  /**
   * Stores a new credential and adds it to the list.
   * @param {AccessCredentialInput} input - Credential with its secret
   * @returns {Promise<AccessCredentialView>} - Stored credential
   * @throws {ApiError} - When the server refuses it
   */
  const create = async (input: AccessCredentialInput): Promise<AccessCredentialView> => {
    const created = await createCredential(input)

    upsert(created)
    return created
  }

  /**
   * Changes a credential and replaces it in the list.
   * @param {number} id - Credential id
   * @param {AccessCredentialPatch} patch - Changed fields, the secret only to replace it
   * @returns {Promise<AccessCredentialView>} - Changed credential
   * @throws {ApiError} - When the server refuses the change
   */
  const update = async (
    id: number,
    patch: AccessCredentialPatch,
  ): Promise<AccessCredentialView> => {
    const updated = await updateCredential(id, patch)

    upsert(updated)
    return updated
  }

  /**
   * Deletes a credential and drops it from the list, also when the server no longer knows it.
   * @param {number} id - Credential id
   * @returns {Promise<void>}
   * @throws {ApiError} - For failures other than 404
   */
  const remove = async (id: number): Promise<void> => {
    try {
      await deleteCredential(id)
    } catch (failure) {
      if (!(failure instanceof ApiError && failure.status === 404)) {
        throw failure
      }
    }

    if (response.value !== null) {
      response.value = withoutCredential(response.value, id)
    }
  }

  /**
   * Tests a credential and stores the result as its last test, one test per credential at a time.
   * @param {number} id - Credential id
   * @returns {Promise<AccessTestResult | null>} - Result, null while a test of it runs
   * @throws {ApiError} - When the server cannot run the test
   */
  const test = async (id: number): Promise<AccessTestResult | null> => {
    if (testing.value.includes(id)) {
      return null
    }

    testing.value = [...testing.value, id]

    try {
      const tested = await testCredential(id)

      upsert(tested)
      return tested.lastTest
    } finally {
      testing.value = testing.value.filter((item) => item !== id)
    }
  }

  /**
   * Returns whether a test of the credential is in flight.
   * @param {number} id - Credential id
   * @returns {boolean} - True while testing
   */
  const isTesting = (id: number): boolean => testing.value.includes(id)

  return {
    loaded,
    error,
    enabled,
    fetcherConfigured,
    credentials,
    load,
    create,
    update,
    remove,
    test,
    isTesting,
  }
})
