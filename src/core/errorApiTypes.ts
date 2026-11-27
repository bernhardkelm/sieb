/** One problem of a rejected request, field null for problems of the whole input */
export interface ValidationIssue {
  field: string | null
  code: string
}

/** Body of a 400 answer */
export interface ValidationErrorBody {
  error: 'validation'
  errors: ValidationIssue[]
}

/** Body of every other non-2xx answer */
export interface ErrorBody {
  error: string
  decisionId?: number // conflicting or revoked decision for 409 answers
}
