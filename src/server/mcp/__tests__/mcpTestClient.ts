import {
  fromJsonSchema,
  InMemoryTransport,
  type CallToolResult,
  type GetPromptResult,
  type JSONRPCMessage,
  type JsonSchemaType,
  type McpServer,
  type Tool,
} from '@modelcontextprotocol/server'

export interface McpTestClient {
  request: <T>(method: string, params: Record<string, unknown>) => Promise<T>
  callTool: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult>
  listTools: () => Promise<Tool[]>
  getPrompt: (name: string, args?: Record<string, string>) => Promise<GetPromptResult>
}

/**
 * Connects a raw JSON-RPC client to a server over the in-memory transport and initializes the
 * session.
 * @param {McpServer} server - Server under test
 * @returns {Promise<McpTestClient>} - Client
 */
export const connectTestClient = async (server: McpServer): Promise<McpTestClient> => {
  const [client, serverSide] = InMemoryTransport.createLinkedPair()
  const pending = new Map<number, (message: JSONRPCMessage) => void>()
  let nextId = 1

  client.onmessage = (message) => {
    if ('id' in message && typeof message.id === 'number') {
      pending.get(message.id)?.(message)
    }
  }

  await server.connect(serverSide)
  await client.start()

  /**
   * Sends a request and waits for its answer.
   * @param {string} method - JSON-RPC method
   * @param {Record<string, unknown>} params - Parameters
   * @returns {Promise<T>} - Result
   * @throws {Error} - On a JSON-RPC error
   */
  const request = <T>(method: string, params: Record<string, unknown>): Promise<T> => {
    const id = nextId++

    return new Promise<T>((resolve, reject) => {
      pending.set(id, (message) => {
        if ('error' in message) {
          reject(new Error(JSON.stringify(message.error)))
        } else if ('result' in message) {
          resolve(message.result as T)
        }
      })
      void client.send({ jsonrpc: '2.0', id, method, params })
    })
  }

  await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  })
  await client.send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  return {
    request,
    callTool: (name, args = {}) => request('tools/call', { name, arguments: args }),
    listTools: async () => (await request<{ tools: Tool[] }>('tools/list', {})).tools,
    getPrompt: (name, args = {}) => request('prompts/get', { name, arguments: args }),
  }
}

/**
 * Checks structured content against the JSON schema the server advertises, which forbids
 * properties the schema does not name.
 * @param {Tool} tool - Listed tool
 * @param {unknown} content - Structured content
 * @returns {Promise<boolean>} - True when valid
 */
export const matchesAdvertisedSchema = async (tool: Tool, content: unknown): Promise<boolean> => {
  const schema = fromJsonSchema(tool.outputSchema as JsonSchemaType)
  const result = await schema['~standard'].validate(content)

  return result.issues === undefined
}
