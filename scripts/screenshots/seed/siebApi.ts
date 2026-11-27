import type { SiebSandbox } from '#scripts/screenshots/sandbox/startSieb.ts'

/** How an MCP client identifies itself: the clientInfo name of initialize and the User-Agent */
export interface McpClient {
  name: string
  userAgent: string
}

export interface SiebApi {
  request: <T>(method: string, path: string, body?: unknown, user?: string) => Promise<T>
  worker: <T>(path: string, body?: unknown) => Promise<T>
  callTool: (secret: string, client: McpClient, name: string, args: object) => Promise<string>
}

const JSON_TYPE = 'application/json'
const USER_HEADER = 'X-authentik-username'
const MCP_PROTOCOL = '2025-06-18'

/**
 * Sends a JSON request and returns the parsed answer.
 * @param {string} url - Absolute URL
 * @param {RequestInit} init - Method, headers and body
 * @returns {Promise<T>} - Parsed JSON, null for an empty answer
 * @throws {Error} - For any status outside 2xx
 */
const requestJson = async <T>(url: string, init: RequestInit): Promise<T> => {
  const response = await fetch(url, init)
  const text = await response.text()

  if (!response.ok) {
    throw new Error(`${init.method} ${url} answered ${response.status}: ${text.slice(0, 300)}`)
  }

  return (text ? JSON.parse(text) : null) as T
}

/**
 * Creates the client the seed uses: the sieb API as the dev user or, through the forward-auth
 * header, as another user, the worker API with the worker
 * secret and MCP tool calls with a personal token, each call preceded by an initialize so sieb
 * records the client name the way a real client announces it.
 * @param {SiebSandbox} sandbox - Running sandbox
 * @returns {SiebApi} - Client
 */
export const createSiebApi = (sandbox: SiebSandbox): SiebApi => {
  let rpcId = 0

  /**
   * Posts one JSON-RPC message to /mcp and returns the answer text.
   * @param {string} secret - Bearer token
   * @param {McpClient} client - Client identity
   * @param {string} method - JSON-RPC method
   * @param {object} params - JSON-RPC params
   * @returns {Promise<string>} - Answer body, JSON or an event stream
   */
  const rpc = async (
    secret: string,
    client: McpClient,
    method: string,
    params: object,
  ): Promise<string> => {
    rpcId += 1
    const response = await fetch(`${sandbox.url}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': JSON_TYPE,
        Accept: `${JSON_TYPE}, text/event-stream`,
        Authorization: `Bearer ${secret}`,
        'User-Agent': client.userAgent,
        'MCP-Protocol-Version': MCP_PROTOCOL,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: rpcId, method, params }),
    })
    const text = await response.text()

    if (!response.ok || text.includes('"isError":true')) {
      throw new Error(`MCP ${method} answered ${response.status}: ${text.slice(0, 400)}`)
    }

    return text
  }

  return {
    request: (method, path, body, user) =>
      requestJson(`${sandbox.url}${path}`, {
        method,
        headers: {
          'Content-Type': JSON_TYPE,
          Origin: sandbox.url,
          ...(user === undefined ? {} : { [USER_HEADER]: user }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    worker: (path, body) =>
      requestJson(`${sandbox.workerUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': JSON_TYPE, Authorization: `Bearer ${sandbox.workerSecret}` },
        body: JSON.stringify(body ?? {}),
      }),
    callTool: async (secret, client, name, args) => {
      await rpc(secret, client, 'initialize', {
        protocolVersion: MCP_PROTOCOL,
        capabilities: {},
        clientInfo: { name: client.name, version: '1.0.0' },
      })

      return rpc(secret, client, 'tools/call', { name, arguments: args })
    },
  }
}
