import { ApiError } from '@/api/ApiError'
import { notifyError } from '@/toast/toastManager'

/**
 * Raises an error toast for a failure unless it is a validation error, which the form or dialog
 * that sent the request shows next to its fields instead.
 * @param {string} title - Toast title
 * @param {unknown} error - Thrown value
 * @returns {void}
 */
export const notifyUnlessValidation = (title: string, error: unknown): void => {
  if (!(error instanceof ApiError && error.isValidation)) {
    notifyError(title, error)
  }
}

/**
 * Toasts a failure unless it is a validation error and rethrows it, for commands whose caller
 * shows validation errors per field.
 * @param {string} title - Toast title
 * @param {unknown} error - Thrown value
 * @returns {never} - Always throws
 */
export const rethrowWithNotice = (title: string, error: unknown): never => {
  notifyUnlessValidation(title, error)
  throw error
}
