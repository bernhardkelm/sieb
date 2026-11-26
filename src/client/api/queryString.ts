export type QueryValue = string | number | boolean | readonly string[] | null | undefined

/**
 * Builds a query string, leaving out empty values and joining lists with commas.
 * @param {Record<string, QueryValue>} params - Parameters
 * @returns {string} - Query string with leading "?", empty without parameters
 */
export const queryString = (params: Record<string, QueryValue>): string => {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === false || value === '') {
      continue
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        search.set(key, value.join(','))
      }

      continue
    }

    search.set(key, String(value))
  }

  const text = search.toString()

  return text === '' ? '' : `?${text}`
}
