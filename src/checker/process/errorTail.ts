import { printable } from '#checker/safeText.ts'

const HEAD_CHARS = 100
const MAX_CHARS = 300

/**
 * Returns the last non-empty line of a process output for an error text, without control
 * characters. A long line keeps its start and its end, where tools such as crane put the error
 * code, for example "MANIFEST_UNKNOWN: manifest unknown".
 * @param {string} text - Output
 * @returns {string} - Last line of at most 300 characters, or "no output"
 */
export const errorTail = (text: string): string => {
  const line = printable(text.trim().split('\n').pop() ?? '').trim()

  if (!line) {
    return 'no output'
  }

  const chars = Array.from(line)

  if (chars.length <= MAX_CHARS) {
    return line
  }

  const tail = chars.slice(-(MAX_CHARS - HEAD_CHARS - 5)).join('')

  return `${chars.slice(0, HEAD_CHARS).join('')} ... ${tail}`
}
