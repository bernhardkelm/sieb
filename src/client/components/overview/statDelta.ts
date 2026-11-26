import { formatCount } from '@/format/count'

/** Which direction of change is an improvement */
export type DeltaPolarity = 'fewer-is-better' | 'neutral'

export type DeltaTone = 'good' | 'bad' | 'neutral'

const MINUS = '−'

/**
 * Formats a change with its sign, a true minus for decreases.
 * @param {number} delta - Change, last minus first
 * @returns {string} - Such as "+12", "−73" or "±0"
 */
export const formatDelta = (delta: number): string => {
  if (delta === 0) {
    return '±0'
  }

  return `${delta > 0 ? '+' : MINUS}${formatCount(Math.abs(delta))}`
}

/**
 * Returns how a change reads: a decrease is good where fewer is better, an increase bad.
 * @param {number} delta - Change, last minus first
 * @param {DeltaPolarity} polarity - Which direction is an improvement
 * @returns {DeltaTone} - Tone of the change
 */
export const deltaTone = (delta: number, polarity: DeltaPolarity): DeltaTone => {
  if (delta === 0 || polarity === 'neutral') {
    return 'neutral'
  }

  return delta < 0 ? 'good' : 'bad'
}

/**
 * Describes a trend in words for assistive technology.
 * @param {number} first - Value at the start of the history
 * @param {number} last - Current value
 * @param {string} period - Period of the history, such as "30 days"
 * @returns {string} - Such as "down 73 over 30 days, from 1,284 to 1,211"
 */
export const describeTrend = (first: number, last: number, period: string): string => {
  const delta = last - first

  if (delta === 0) {
    return `unchanged at ${formatCount(last)} over ${period}`
  }

  const direction = delta > 0 ? 'up' : 'down'

  return `${direction} ${formatCount(Math.abs(delta))} over ${period}, from ${formatCount(first)} to ${formatCount(last)}`
}
