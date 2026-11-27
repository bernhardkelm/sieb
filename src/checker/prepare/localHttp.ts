import { request } from 'node:http'

const MAX_ANSWER_BYTES = 1024 * 1024

/** Answer of the fetcher's local endpoint */
export interface LocalAnswer {
  status: number
  body: unknown // parsed JSON, null for an empty or non-JSON body
}

/** One request to the fetcher's local endpoint */
export interface LocalRequest {
  baseUrl: string // http://127.0.0.1:<port>
  path: string
  secret: string // local shared secret, sent as bearer token
  body: unknown
  signal: AbortSignal // aborts the request, the fetcher stops its work when the connection closes
}

/**
 * Parses an answer body.
 * @param {Buffer} data - Raw body
 * @returns {unknown} - Parsed JSON, null when empty or invalid
 */
const parseBody = (data: Buffer): unknown => {
  try {
    return data.length === 0 ? null : JSON.parse(data.toString('utf8'))
  } catch {
    return null
  }
}

/**
 * Sends a JSON POST to the fetcher with node:http, which has no default headers or body
 * timeout, so a long image preparation is limited by the signal alone.
 * @param {LocalRequest} options - Base URL, path, secret, body and abort signal
 * @returns {Promise<LocalAnswer>} - Status and parsed body
 * @throws {Error} - When the connection fails, the signal fires or the answer is too large
 */
export const postLocal = (options: LocalRequest): Promise<LocalAnswer> =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(options.body)
    const req = request(
      new URL(options.path, options.baseUrl),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.secret}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
        signal: options.signal,
      },
      (res) => {
        const chunks: Buffer[] = []
        let size = 0

        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_ANSWER_BYTES) {
            req.destroy(new Error('the fetcher answer is too large'))

            return
          }

          chunks.push(chunk)
        })
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: parseBody(Buffer.concat(chunks)) }),
        )
        res.on('error', reject)
      },
    )

    req.on('error', reject)
    req.end(payload)
  })
