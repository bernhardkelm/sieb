// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createClientNameMemory } from '#server/mcp/clientNameMemory.ts'
import { clientNameIn } from '#server/mcp/handshakeLog.ts'

const META = 'io.modelcontextprotocol/clientInfo'

describe('clientNameIn', () => {
  it('reads the clientInfo of a handshake and the _meta envelope of any request', () => {
    const call = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'x' } }
    const modern = { ...call, params: { name: 'x', _meta: { [META]: { name: 'claude-code' } } } }
    const initialize = {
      method: 'initialize',
      params: { clientInfo: { name: 'Anthropic/ClaudeAI' } },
    }

    expect(clientNameIn([call])).toBeNull()
    expect(clientNameIn([modern])).toBe('claude-code')
    expect(clientNameIn([call, initialize])).toBe('Anthropic/ClaudeAI')
    expect(clientNameIn([])).toBeNull()
  })
})

describe('createClientNameMemory', () => {
  it('answers a request without a name from the same caller and User-Agent only', () => {
    const memory = createClientNameMemory()

    expect(memory.resolve('oauth:alice', 'cloud/1', 'Anthropic/ClaudeAI')).toBe(
      'Anthropic/ClaudeAI',
    )
    expect(memory.resolve('oauth:alice', 'cloud/1', null)).toBe('Anthropic/ClaudeAI')
    expect(memory.resolve('oauth:alice', 'claude-code/2.1.0 (cli)', null)).toBeNull()
    expect(memory.resolve('oauth:bob', 'cloud/1', null)).toBeNull()
    expect(memory.resolve('oauth:alice', 'cloud/1', 'other')).toBe('other')
    expect(memory.resolve('oauth:alice', 'cloud/1', null)).toBe('other')
  })

  it('drops the oldest entry beyond its size', () => {
    const memory = createClientNameMemory(2)

    memory.resolve('a', null, 'one')
    memory.resolve('b', null, 'two')
    memory.resolve('a', null, 'one')
    memory.resolve('c', null, 'three')

    expect(memory.resolve('b', null, null)).toBeNull()
    expect(memory.resolve('a', null, null)).toBe('one')
    expect(memory.resolve('c', null, null)).toBe('three')
  })
})
