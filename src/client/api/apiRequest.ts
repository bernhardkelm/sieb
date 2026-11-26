import { ApiError } from '@/api/ApiError'
import { handleUnauthorized } from '@/api/session'
import { knownErrorMessage } from '@/format/labels'

const SAFE_METHODS = ['GET', 'HEAD']

/**
 * Parses an error body, tolerating answers that are no JSON.
 * @param {Response} response - Failed response
 * @returns {Promise<ConstructorParameters<typeof ApiError>[1]>} - Parsed body, empty when unreadable
 */
const errorBody = async (
  response: Response,
): Promise<ConstructorParameters<typeof ApiError>[1]> => {
  try {
    return (await response.json()) as ConstructorParameters<typeof ApiError>[1]
  } catch {
    return {}
  }
}

/**
 * Sends a JSON request to the API server and parses the answer. Writes always carry the JSON
 * content type, also without a body, the server refuses them otherwise.
 * @param {string} url - API path with query string
 * @param {string} method - HTTP method
 * @param {unknown} body - JSON body, left out when undefined
 * @returns {Promise<T>} - Parsed answer, undefined for 204
 * @throws {ApiError} - For any status outside 2xx
 */
export const apiRequest = async <T>(url: string, method = 'GET', body?: unknown): Promise<T> => {
  const init: RequestInit = { method, headers: { Accept: 'application/json' } }

  if (!SAFE_METHODS.includes(method)) {
    init.headers = { Accept: 'application/json', 'Content-Type': 'application/json' }
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  const response = await fetch(url, init)

  if (response.status === 401 && handleUnauthorized(SAFE_METHODS.includes(method))) {
    return new Promise<T>(() => {})
  }

  if (!response.ok) {
    throw new ApiError(response.status, await errorBody(response), url)
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

/**
 * Returns a displayable message for a thrown value, the readable text of known API error codes.
 * @param {unknown} error - Thrown value
 * @returns {string} - Message
 */
export const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return knownErrorMessage(error.code) ?? error.message
  }

  return error instanceof Error ? error.message : String(error)
}
