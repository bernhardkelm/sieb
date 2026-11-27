import { flushPromises } from '@vue/test-utils'

import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import AccessView from '@/views/AccessView.vue'

/**
 * Mounts the Access page on its route and waits for the credentials to load.
 * @returns {Promise<RoutedMount>} - Wrapper and router
 */
export const mountAccessPage = async (): Promise<RoutedMount> => {
  const mounted = await mountWithRouter(AccessView, '/access')

  await flushPromises()
  return mounted
}

/**
 * Returns a button of the page by its text or accessible name.
 * @param {string} name - Text or aria-label
 * @returns {HTMLButtonElement | undefined} - Button
 */
export const button = (name: string): HTMLButtonElement | undefined =>
  [...document.body.querySelectorAll('button')].find(
    (candidate) =>
      candidate.getAttribute('aria-label') === name || candidate.textContent?.trim() === name,
  )

/**
 * Clicks a button by its text or accessible name and waits for the updates.
 * @param {string} name - Text or aria-label
 * @returns {Promise<void>}
 */
export const press = async (name: string): Promise<void> => {
  const target = button(name)

  if (target === undefined) {
    throw new Error(`No button ${name}`)
  }

  target.click()
  await flushPromises()
}

/**
 * Returns the input a label names.
 * @param {string} text - Label text
 * @returns {HTMLInputElement | null} - Input, null when no such field shows
 */
export const field = (text: string): HTMLInputElement | null => {
  const label = [...document.body.querySelectorAll('label')].find(
    (candidate) => candidate.textContent?.trim() === text,
  )

  return label === undefined ? null : (document.getElementById(label.htmlFor) as HTMLInputElement)
}

/**
 * Types a value into the field a label names.
 * @param {string} text - Label text
 * @param {string} value - Value
 * @returns {void}
 */
export const type = (text: string, value: string): void => {
  const input = field(text)

  if (input === null) {
    throw new Error(`No field ${text}`)
  }

  input.value = value
  input.dispatchEvent(new Event('input'))
}

/**
 * Picks a provider in the add form.
 * @param {string} label - Provider label, such as GitLab
 * @returns {Promise<void>}
 */
export const pickProvider = async (label: string): Promise<void> => {
  const radio = [...document.body.querySelectorAll<HTMLElement>('[role="radio"]')].find(
    (candidate) => candidate.textContent?.trim() === label,
  )

  radio?.click()
  await flushPromises()
}

/**
 * Submits the credential form and waits for the save.
 * @returns {Promise<void>}
 */
export const submitForm = async (): Promise<void> => {
  document.body.querySelector('form.credential-form')!.dispatchEvent(new Event('submit'))
  await flushPromises()
}
