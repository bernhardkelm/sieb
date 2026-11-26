import { createToastManager } from 'reka-ui'

import { errorMessage } from '@/api/apiRequest'

export const toast = createToastManager()

/**
 * Shows a success toast.
 * @param {string} title - Short message
 * @param {string} description - Optional detail
 * @returns {void}
 */
export const notifySuccess = (title: string, description?: string): void => {
  toast.add({ title, description, status: 'success', type: 'foreground' })
}

/**
 * Shows an error toast that stays until dismissed.
 * @param {string} title - Short message
 * @param {unknown} error - Thrown value, described below the title
 * @returns {void}
 */
export const notifyError = (title: string, error: unknown): void => {
  toast.add({
    title,
    description: errorMessage(error),
    status: 'error',
    type: 'foreground',
    duration: 0,
  })
}
