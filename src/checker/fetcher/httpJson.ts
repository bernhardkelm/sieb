import type { IncomingMessage, ServerResponse } from 'node:http'

const MAX_BODY_BYTES = 64 * 1024

/**
 * Writes a JSON answer, or an empty one without body.
 * @param {ServerResponse} res - Response
 * @param {number} status - HTTP status
 * @param {unknown} body - JSON body, undefined for none
 * @returns {void}
 */
export const send = (res: ServerResponse, status: number, body?: unknown): void => {
  if (body === undefined) {
    res.writeHead(status).end()

    return
  }

  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
}

/**
 * Reads a JSON request body of at most 64 KiB.
 * @param {IncomingMessage} req - Request
 * @returns {Promise<unknown>} - Parsed body, null when it is too large or no JSON
 */
export const readJson = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      return null
    }

    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}
