// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { CLAUDE_SUCCESS } from '#checker/__tests__/fakeRunner.ts'
import { claudeResult, parseClaudeOutput } from '#checker/claude/claudeOutput.ts'
import type { CapturedRun } from '#checker/process/runCaptured.ts'

/**
 * Builds a captured run.
 * @param {Partial<CapturedRun>} run - Fields to override
 * @returns {CapturedRun} - A run that exited 0 by default
 */
const captured = (run: Partial<CapturedRun>): CapturedRun => ({
  exit: { code: 0, signal: null, error: null },
  stdout: '',
  stdoutTruncated: false,
  stderr: '',
  timedOut: false,
  aborted: false,
  ...run,
})

describe('parseClaudeOutput', () => {
  it('reads usage, cost, turns and the final reply', () => {
    expect(parseClaudeOutput(CLAUDE_SUCCESS)).toEqual({
      usage: {
        inputTokens: 1200,
        outputTokens: 300,
        cacheReadTokens: 5000,
        cacheCreationTokens: 800,
        costUsd: 0.42,
        turns: 7,
        models: [],
      },
      reply: '**CVE-2099-0001 · nginx:1.27** → not_affected · confidence high',
      isError: false,
      subtype: 'success',
    })
  })

  it('caps the reply at 4000 characters and tolerates missing fields', () => {
    const output = parseClaudeOutput(JSON.stringify({ result: 'x'.repeat(5000), num_turns: 2 }))

    expect(output?.reply).toHaveLength(4000)
    expect(output?.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: null,
      turns: 2,
      models: [],
    })
    expect(parseClaudeOutput('not json')).toBeNull()
    expect(parseClaudeOutput('[1]')).toBeNull()
  })
})

describe('parseClaudeOutput models', () => {
  const parse = (modelUsage: unknown) =>
    parseClaudeOutput(JSON.stringify({ num_turns: 1, modelUsage }))?.usage?.models

  it('lists the models by output tokens, most first', () => {
    expect(
      parse({
        'claude-haiku-5': { outputTokens: 10 },
        'claude-opus-5-5': { outputTokens: 900 },
        'claude-sonnet-5-5': { outputTokens: 10 },
      }),
    ).toEqual(['claude-opus-5-5', 'claude-haiku-5', 'claude-sonnet-5-5'])
  })

  it('ignores garbage and unknown structure', () => {
    expect(parse(undefined)).toEqual([])
    expect(parse([1, 2])).toEqual([])
    expect(parse('opus')).toEqual([])
    expect(parse({ 'bad id!': { outputTokens: 1 }, ok: 'x', ['x'.repeat(200)]: {} })).toEqual([
      'ok',
    ])
  })

  it('caps the list', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`m${i}`, {}]))

    expect(parse(many)).toHaveLength(8)
  })
})

describe('claudeResult', () => {
  it('reports a clean run as done', () => {
    expect(claudeResult(captured({ stdout: CLAUDE_SUCCESS }), 900)).toMatchObject({
      status: 'done',
      error: null,
      usage: expect.objectContaining({ turns: 7 }),
    })
  })

  it('maps timeouts, errors, exit codes and missing output to short errors', () => {
    const maxTurns = JSON.stringify({ subtype: 'error_max_turns', is_error: true, num_turns: 40 })
    const failed = JSON.stringify({ is_error: true, result: 'Not logged in\nRun /login' })
    const cases: [Partial<CapturedRun>, string][] = [
      [
        { timedOut: true, exit: { code: null, signal: 'SIGKILL', error: null } },
        'Claude timed out after 900 s',
      ],
      [
        { exit: { code: null, signal: null, error: 'spawn claude ENOENT' } },
        'Claude could not start: spawn claude ENOENT',
      ],
      [
        { stdout: maxTurns, exit: { code: 1, signal: null, error: null } },
        'Claude reached the turn limit',
      ],
      [{ stdout: failed }, 'Claude reported an error: Run /login'],
      [
        { exit: { code: 2, signal: null, error: null }, stderr: 'boom\n' },
        'Claude exited with 2: boom',
      ],
      [{ stdout: '' }, 'Claude returned no JSON result'],
    ]

    for (const [run, error] of cases) {
      expect(claudeResult(captured(run), 900)).toMatchObject({ status: 'failed', error })
    }

    expect(claudeResult(captured({ stdout: maxTurns }), 900).usage?.turns).toBe(40)
  })
})
