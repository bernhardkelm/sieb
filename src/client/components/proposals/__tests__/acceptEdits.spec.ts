import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/ApiError'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'
import { acceptEdits, editInitial, formErrorOfAccept } from '@/components/proposals/acceptEdits'
import { PROPOSED_VALUES as proposed } from '@/__tests__/proposalDetailBuilders'

/**
 * Builds a submitted form value equal to the proposed values.
 * @param {Partial<DecisionFormValue>} overrides - Fields to set
 * @returns {DecisionFormValue} - Form value
 */
const formValue = (overrides: Partial<DecisionFormValue> = {}): DecisionFormValue => ({
  status: proposed.status,
  justification: proposed.justification,
  reason: proposed.reason,
  scope: 'image',
  expiresAt: '2027-05-26T21:59:59.000Z',
  expiryTouched: false,
  reconfirm: false,
  ...overrides,
})

describe('acceptEdits', () => {
  it('prefills the form with the values accepting writes', () => {
    expect(editInitial(proposed)).toEqual({ ...proposed, scope: 'image' })
  })

  it('sends nothing for an unchanged form, so the untouched expiry stays as proposed', () => {
    expect(acceptEdits(proposed, formValue())).toEqual({})
  })

  it('sends only the changed fields and a touched expiry', () => {
    expect(
      acceptEdits(
        proposed,
        formValue({
          status: 'accepted',
          justification: null,
          reason: 'Risk accepted until the upgrade.',
          expiryTouched: true,
          expiresAt: null,
        }),
      ),
    ).toEqual({ status: 'accepted', reason: 'Risk accepted until the upgrade.', expiresAt: null })
    expect(acceptEdits(proposed, formValue({ justification: 'component_not_present' }))).toEqual({
      justification: 'component_not_present',
    })
  })

  it('starts Decide myself without a status and sends status and reason as edits', () => {
    expect(editInitial(null)).toEqual({ scope: 'image' })
    expect(
      acceptEdits(
        null,
        formValue({ status: 'not_affected', justification: null, reason: 'Checked by hand.' }),
      ),
    ).toEqual({ status: 'not_affected', justification: null, reason: 'Checked by hand.' })
  })

  it('maps edits.<field> errors to the form fields', () => {
    const error = new ApiError(
      400,
      { error: 'validation', errors: [{ field: 'edits.reason', code: 'too_long' }] },
      '/api/proposals/7/accept',
    )
    const mapped = formErrorOfAccept(error) as ApiError

    expect(mapped.fieldErrors('reason')).toEqual(['too_long'])
    expect(formErrorOfAccept('offline')).toBe('offline')
  })
})
