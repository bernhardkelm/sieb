import { hasLocalErrors, localFormErrors } from '@/components/decision/decisionFormErrors'
import {
  fromDateInput,
  justificationFor,
  upstreamFor,
  type DecisionFormValue,
} from '@/components/decision/decisionFormModel'
import type { DecisionFormErrorState } from '@/composables/useDecisionFormErrors'
import type { DecisionFormFields } from '@/composables/useDecisionFormFields'

export interface DecisionFormSubmitOptions {
  fields: DecisionFormFields
  errors: DecisionFormErrorState
  /** Whether the form offers to re-confirm a re-opened decision */
  reconfirmable: () => boolean
  focusStatus: () => void
  focusReason: () => void
  emitSubmit: (value: DecisionFormValue) => void
}

export interface DecisionFormSubmit {
  submit: () => void
  /** Submits on Cmd+Enter or Ctrl+Enter from anywhere in the form, never on a key repeat */
  onKeydown: (event: KeyboardEvent) => void
}

/**
 * Submits the decision form: a missing status, a blank reason, a missing date or a missing
 * waiting for text stops with their messages and focuses the status or reason in error, a
 * valid input is emitted.
 * @param {DecisionFormSubmitOptions} options - Fields, messages, focus targets and the emitter
 * @returns {DecisionFormSubmit} - Submit action and the key handler of the form
 */
export const useDecisionFormSubmit = (options: DecisionFormSubmitOptions): DecisionFormSubmit => {
  const { fields, errors } = options

  /**
   * Checks the input and emits it.
   * @returns {void}
   */
  const submit = (): void => {
    const expiresAt = fields.never.value ? null : fromDateInput(fields.expiryDate.value)
    const chosen = fields.status.value
    const upstream =
      chosen === null
        ? { upstreamPending: false, waitingFor: null }
        : upstreamFor(chosen, fields.upstreamPending.value, fields.waitingFor.value)

    errors.local.value = localFormErrors({
      status: chosen,
      reason: fields.reason.value,
      never: fields.never.value,
      expiresAt,
      upstreamPending: upstream.upstreamPending,
      waitingFor: upstream.waitingFor ?? '',
    })

    if (chosen === null || hasLocalErrors(errors.local.value)) {
      if (chosen === null) {
        options.focusStatus()
      } else if (errors.local.value.reason.length > 0) {
        options.focusReason()
      }

      return
    }

    options.emitSubmit({
      status: chosen,
      justification: justificationFor(chosen, fields.justification.value),
      reason: fields.reason.value.trim(),
      scope: fields.scope.value,
      expiresAt,
      expiryTouched: fields.expiryTouched.value,
      reconfirm: options.reconfirmable() && fields.reconfirm.value,
      ...upstream,
    })
  }

  /**
   * Submits on the command chord.
   * @param {KeyboardEvent} event - Keydown event inside the form
   * @returns {void}
   */
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()

      if (!event.repeat) {
        submit()
      }
    }
  }

  return { submit, onKeydown }
}
