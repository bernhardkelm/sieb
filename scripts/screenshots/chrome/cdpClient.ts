export interface CdpEvent {
  method: string
  params: Record<string, unknown>
}

export interface CdpClient {
  send: <T = Record<string, unknown>>(method: string, params?: object) => Promise<T>
  onEvent: (listener: (event: CdpEvent) => void) => void
  close: () => void
}

interface Pending {
  resolve: (value: Record<string, unknown>) => void
  reject: (error: Error) => void
}

interface CdpMessage {
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: { message: string }
}

/**
 * Connects to a DevTools protocol target over Node's built-in WebSocket.
 * @param {string} url - webSocketDebuggerUrl of the target
 * @returns {Promise<CdpClient>} - Client sending commands and relaying events
 */
export const connectCdp = async (url: string): Promise<CdpClient> => {
  const socket = new WebSocket(url)
  const pending = new Map<number, Pending>()
  const listeners: ((event: CdpEvent) => void)[] = []
  let nextId = 0

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as CdpMessage
    const waiting = message.id === undefined ? undefined : pending.get(message.id)

    if (waiting !== undefined && message.id !== undefined) {
      pending.delete(message.id)

      if (message.error) {
        waiting.reject(new Error(message.error.message))
      } else {
        waiting.resolve(message.result ?? {})
      }
    } else if (message.method !== undefined) {
      for (const listener of listeners) {
        listener({ method: message.method, params: message.params ?? {} })
      }
    }
  })

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)), {
      once: true,
    })
  })

  return {
    send: <T>(method: string, params: object = {}) =>
      new Promise<T>((resolve, reject) => {
        nextId += 1
        pending.set(nextId, {
          resolve: (value) => resolve(value as T),
          reject: (error) => reject(new Error(`${method}: ${error.message}`)),
        })
        socket.send(JSON.stringify({ id: nextId, method, params }))
      }),
    onEvent: (listener) => {
      listeners.push(listener)
    },
    close: () => {
      socket.close()
    },
  }
}
