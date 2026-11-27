import { describe, expect, it } from 'vitest'

import { proposalClientKind, storedClientKind } from '#core/proposalClient.ts'

/**
 * Derives the kind of a non-check request.
 * @param {string | null} clientName - clientInfo name
 * @param {string | null} userAgent - User-Agent
 * @returns {string | null} - Client kind
 */
const kindOf = (clientName: string | null, userAgent: string | null): string | null =>
  proposalClientKind({ clientName, userAgent }, false)

describe('proposalClientKind', () => {
  it.each([
    ['claude-code/2.1.332 (cli)', 'claude_code_cli'],
    ['claude-code/2.1.332 (sdk-cli)', 'claude_code_headless'],
    ['claude-code/2.1.332 (sdk-ts)', 'claude_code_headless'],
    ['claude-code/2.1.332 (sdk-py)', 'claude_code_headless'],
    ['claude-code/2.1.332 (claude-vscode)', 'claude_code_vscode'],
    ['claude-code/2.1.332 (claude-desktop)', 'claude_code_app'],
    ['claude-code/2.1.332 (cli, agent-sdk/0.2.1)', 'claude_code_cli'],
    ['claude-code/2.1.332 (remote)', 'claude_code'],
    ['claude-code/2.1.332', 'claude_code'],
  ])('maps the Claude Code User-Agent %s to %s', (userAgent, kind) => {
    expect(kindOf('claude-code', userAgent)).toBe(kind)
    expect(kindOf(null, userAgent)).toBe(kind)
  })

  it('takes Claude Code and the claude.ai connector from the clientInfo name', () => {
    expect(kindOf('claude-code', null)).toBe('claude_code')
    expect(kindOf('Anthropic/ClaudeAI', null)).toBe('claude_app')
    expect(kindOf(' anthropic/claudeai ', 'python-httpx/0.28.1')).toBe('claude_app')
  })

  it('marks every proposal of an Auto-check token as auto_check', () => {
    expect(proposalClientKind({ clientName: null, userAgent: null }, true)).toBe('auto_check')
    expect(
      proposalClientKind({ clientName: 'claude-code', userAgent: 'claude-code/2 (sdk-cli)' }, true),
    ).toBe('auto_check')
  })

  it('leaves unknown clients and malformed User-Agents without a kind', () => {
    expect(kindOf(null, null)).toBeNull()
    expect(kindOf('cursor', 'Cursor/1.0')).toBeNull()
    expect(kindOf(null, 'Mozilla/5.0 claude-code/2.1.0 (cli)')).toBeNull()
    expect(kindOf(null, 'claude-code/ (cli)')).toBeNull()
    expect(kindOf(null, 'claude-code-fork/2.1.0 (cli)')).toBeNull()
    expect(kindOf(null, `claude-code/2.1.0 (${'x'.repeat(500)})`)).toBe('claude_code')
    expect(kindOf(null, 'claude-code/2.1.0 (CLI)\n<script>')).toBe('claude_code')
  })
})

describe('storedClientKind', () => {
  it('reads known kinds and drops anything else', () => {
    expect(storedClientKind('claude_code_vscode')).toBe('claude_code_vscode')
    expect(storedClientKind('claude_code_jetbrains')).toBeNull()
    expect(storedClientKind(null)).toBeNull()
  })
})
