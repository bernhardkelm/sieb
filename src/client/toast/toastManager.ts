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

/**
 * Shows a persistent toast that tells a write failed because the session ended.
 * @param {() => void} onLogin - Starts the login
 * @returns {void}
 */
export const notifySessionExpired = (onLogin: () => void): void => {
  toast.add({
    id: 'session-expired',
    title: 'Session expired',
    description: 'Log in again to save. Your draft stays open.',
    status: 'error',
    type: 'foreground',
    duration: 0,
    actionProps: { label: 'Log in', altText: 'Log in again', onClick: onLogin },
  })
}

export interface ToastActionChoice {
  /** Button text */
  label: string
  /** Name of the action for screen readers, which announce the toast without its button */
  altText: string
  onClick: () => void
}

/**
 * Shows a neutral toast with one action button, such as a fallback for a step sieb cannot check.
 * A later toast with the same id replaces it instead of stacking.
 * @param {string} id - Toast id
 * @param {string} title - Short message
 * @param {string} description - Detail
 * @param {ToastActionChoice} action - Button and its handler
 * @returns {void}
 */
export const notifyWithAction = (
  id: string,
  title: string,
  description: string,
  action: ToastActionChoice,
): void => {
  toast.add({ id, title, description, type: 'foreground', duration: 8000, actionProps: action })
}

/**
 * Shows a neutral toast, such as an action that ran but changed nothing.
 * @param {string} title - Short message
 * @param {string} description - Optional detail
 * @returns {void}
 */
export const notifyNotice = (title: string, description?: string): void => {
  toast.add({ title, description, type: 'foreground', duration: 8000 })
}
