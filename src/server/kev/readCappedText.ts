/**
 * Reads a response body as UTF-8 text, refusing bodies larger than a limit. A larger declared
 * Content-Length fails before reading, a body that grows past the limit while streaming cancels
 * the stream.
 * @param {Response} response - Response with an unread body
 * @param {number} maxBytes - Largest accepted body in bytes
 * @returns {Promise<string>} - Body text
 * @throws {Error} - When the body exceeds maxBytes
 */
export const readCappedText = async (response: Response, maxBytes: number): Promise<string> => {
  const declared = Number(response.headers.get('content-length'))

  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel()
    throw new Error(`response of ${declared} bytes exceeds the limit of ${maxBytes} bytes`)
  }

  if (!response.body) {
    return ''
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    size += value.byteLength

    if (size > maxBytes) {
      await reader.cancel()
      throw new Error(`response exceeds the limit of ${maxBytes} bytes`)
    }

    chunks.push(value)
  }

  return Buffer.concat(chunks).toString('utf8')
}
