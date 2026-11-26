import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

import type { DecisionJustification, DecisionScope, DecisionStatus } from '#core/decision.ts'
import {
  defaultExpiryDate,
  toDateInput,
  type DecisionFormInitial,
} from '@/components/decision/decisionFormModel'

export interface DecisionFormFields {
  status: Ref<DecisionStatus | null>
  justification: Ref<DecisionJustification | null>
  reason: Ref<string>
  scope: Ref<DecisionScope>
  reconfirm: Ref<boolean>
  /** Whether the user changed the expiry, the status default no longer applies */
  expiryTouched: Ref<boolean>
  /** Expiry as YYYY-MM-DD, empty while never is set */
  expiryDate: Ref<string>
  never: Ref<boolean>
  /** Whether the form holds input that leaving would discard */
  dirty: ComputedRef<boolean>
}

/**
 * Holds the fields of the decision form, started from the initial values. While the expiry is
 * untouched it follows the status: the given expiry for the starting status, the default of any
 * other status, as the server applies it, and no expiry while no status is chosen.
 * @param {DecisionFormInitial} initial - Starting values
 * @returns {DecisionFormFields} - Field state and the dirty flag
 */
export const useDecisionFormFields = (initial: DecisionFormInitial): DecisionFormFields => {
  const initialStatus = initial.status ?? null
  const initialReason = initial.reason ?? ''
  const initialScope = initial.scope ?? 'image'
  const initialJustification = initial.justification ?? null

  const status = ref<DecisionStatus | null>(initialStatus)
  const justification = ref<DecisionJustification | null>(initialJustification)
  const reason = ref(initialReason)
  const scope = ref<DecisionScope>(initialScope)
  const reconfirm = ref(false)
  const expiryTouched = ref(false)

  /**
   * Returns the date the form shows for a status while the expiry is untouched.
   * @param {DecisionStatus | null} next - Status, null for none
   * @returns {string | null} - Date as YYYY-MM-DD, null for no expiry
   */
  const expiryDateFor = (next: DecisionStatus | null): string | null => {
    const given = initial.expiresAt

    if (next === null) {
      return null
    }

    if (given !== undefined && next === initialStatus) {
      return given === null ? null : toDateInput(given)
    }

    return defaultExpiryDate(next, new Date())
  }

  const initialDate = expiryDateFor(initialStatus)
  const expiryDate = ref(initialDate ?? '')
  const never = ref(initialDate === null)

  const dirty = computed(
    () =>
      reason.value.trim() !== initialReason.trim() ||
      scope.value !== initialScope ||
      justification.value !== initialJustification ||
      expiryTouched.value ||
      reconfirm.value,
  )

  watch(status, (next) => {
    if (!expiryTouched.value) {
      const date = expiryDateFor(next)

      never.value = date === null
      expiryDate.value = date ?? ''
    }
  })

  return {
    status,
    justification,
    reason,
    scope,
    reconfirm,
    expiryTouched,
    expiryDate,
    never,
    dirty,
  }
}
