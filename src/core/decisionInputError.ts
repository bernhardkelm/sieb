export type DecisionField =
  | 'vulnId'
  | 'scope'
  | 'imageRef'
  | 'imageRefs'
  | 'status'
  | 'justification'
  | 'reason'
  | 'expiresAt'
  | 'upstreamPending'
  | 'waitingFor'
  | 'reconfirm'
  | 'comment'

export type DecisionErrorCode =
  | 'required'
  | 'invalid'
  | 'in_past'
  | 'too_far'
  | 'too_long'
  | 'too_many'
  | 'not_allowed'
  | 'empty_patch'

export interface DecisionInputError {
  field: DecisionField | null // null for errors about the whole input
  code: DecisionErrorCode
}

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: DecisionInputError[] }
