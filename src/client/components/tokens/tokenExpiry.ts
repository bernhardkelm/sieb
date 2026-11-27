import { DAY_MS } from '#core/timeUnits.ts'

export type ExpiryChoice = '30' | '90' | '365'

export const EXPIRY_OPTIONS: { value: ExpiryChoice; label: string }[] = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
]

/**
 * Returns the expiry time of a new token.
 * @param {ExpiryChoice} choice - Days until expiry
 * @param {Date} now - Current time
 * @returns {string} - ISO timestamp
 */
export const expiryDate = (choice: ExpiryChoice, now: Date): string =>
  new Date(now.getTime() + Number(choice) * DAY_MS).toISOString()
