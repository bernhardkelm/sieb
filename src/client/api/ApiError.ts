import type { ValidationIssue } from '#core/errorApiTypes.ts'
import type { AccessTestResult } from '#core/privateAccess.ts'

interface ErrorAnswer {
  error?: string
  errors?: ValidationIssue[]
  decisionId?: number
  result?: AccessTestResult // credential test of a save the test refused
}

/** Thrown for an API answer outside 2xx, carries the error code and the validation errors */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly errors: ValidationIssue[]
  readonly decisionId: number | null
  readonly testResult: AccessTestResult | null

  /**
   * Creates the error from an API answer.
   * @param {number} status - HTTP status
   * @param {ErrorAnswer} body - Parsed error body, empty when unreadable
   * @param {string} url - Requested URL, used in the message
   * @returns {void}
   */
  constructor(status: number, body: ErrorAnswer, url: string) {
    super(`API answered ${status} ${body.error ?? 'error'} for ${url}`)
    this.name = 'ApiError'
    this.status = status
    this.code = body.error ?? 'unknown'
    this.errors = body.errors ?? []
    this.decisionId = body.decisionId ?? null
    this.testResult = body.result ?? null
  }

  /**
   * Returns whether the server rejected the input.
   * @returns {boolean} - True for 400 validation answers
   */
  get isValidation(): boolean {
    return this.code === 'validation'
  }

  /**
   * Returns the validation error codes of one field.
   * @param {string | null} field - Field name, null for errors of the whole input
   * @returns {string[]} - Error codes
   */
  fieldErrors(field: string | null): string[] {
    return this.errors.filter((issue) => issue.field === field).map((issue) => issue.code)
  }
}
