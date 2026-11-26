import { ApiError } from '@/api/ApiError'
import { errorMessage } from '@/api/apiRequest'

/**
 * Returns a displayable message for a failed token request, naming the token for not_found
 * instead of the decision wording the shared message uses.
 * @param {unknown} error - Thrown value
 * @returns {string} - Message
 */
export const tokenErrorMessage = (error: unknown): string =>
  error instanceof ApiError && error.code === 'not_found'
    ? 'This token no longer exists.'
    : errorMessage(error)
