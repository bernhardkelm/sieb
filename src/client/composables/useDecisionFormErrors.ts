import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

import {
  decisionFormErrors,
  type DecisionFormErrors,
  type LocalFormErrors,
} from '@/components/decision/decisionFormErrors'
import type { DecisionFormFields } from '@/composables/useDecisionFormFields'

export interface DecisionFormErrorState {
  /** Messages of the checks before submit, cleared per field once it changes */
  local: Ref<LocalFormErrors>
  /** Messages of the last failed save per field */
  server: ComputedRef<DecisionFormErrors>
  status: ComputedRef<string[]>
  reason: ComputedRef<string[]>
  expiresAt: ComputedRef<string[]>
}

/**
 * Merges the local checks and the failed save of the decision form per field. Changing a field
 * clears its local messages; server messages stay until the next save answers.
 * @param {DecisionFormFields} fields - Form fields
 * @param {() => unknown} error - Failure of the last save, null or undefined without one
 * @returns {DecisionFormErrorState} - Messages per field
 */
export const useDecisionFormErrors = (
  fields: DecisionFormFields,
  error: () => unknown,
): DecisionFormErrorState => {
  const local = ref<LocalFormErrors>({ status: [], reason: [], expiresAt: [] })
  const server = computed(() => decisionFormErrors(error()))

  watch(fields.status, () => {
    local.value.status = []
  })

  watch(fields.reason, () => {
    local.value.reason = []
  })

  watch([fields.expiryDate, fields.never], () => {
    local.value.expiresAt = []
  })

  return {
    local,
    server,
    status: computed(() => [...local.value.status, ...server.value.status]),
    reason: computed(() => [...local.value.reason, ...server.value.reason]),
    expiresAt: computed(() => [...local.value.expiresAt, ...server.value.expiresAt]),
  }
}
