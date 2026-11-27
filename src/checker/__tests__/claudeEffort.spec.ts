import { describe, expect, it } from 'vitest'

import { claudeArgs } from '#checker/claude/claudeInvocation.ts'
import { parseClaudeEffort } from '#checker/config/claudeEffort.ts'

const LAYOUT = {
  workspace: '/work/check-1',
  home: '/work/check-1/home',
  tmp: '/work/check-1/tmp',
  mcpConfig: '/work/check-1/mcp.json',
  settings: '/work/check-1/settings.json',
}

describe('parseClaudeEffort', () => {
  it('keeps the default when unset or blank', () => {
    expect(parseClaudeEffort(undefined)).toBeNull()
    expect(parseClaudeEffort('  ')).toBeNull()
  })

  it('accepts every level, case-insensitive', () => {
    for (const level of ['low', 'medium', 'high', 'xhigh', 'max']) {
      expect(parseClaudeEffort(` ${level.toUpperCase()} `)).toBe(level)
    }
  })

  it('refuses an unknown level', () => {
    expect(() => parseClaudeEffort('extreme')).toThrow('SIEB_CHECKER_EFFORT must be one of')
  })
})

describe('claudeArgs effort', () => {
  it('passes --effort only when set', () => {
    const layout = LAYOUT as Parameters<typeof claudeArgs>[1]

    expect(claudeArgs('x', layout, 1, [], 'opus', 'high').slice(-4)).toEqual([
      '--model',
      'opus',
      '--effort',
      'high',
    ])
    expect(claudeArgs('x', layout, 1, [], null, null)).not.toContain('--effort')
  })
})
