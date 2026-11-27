import { describe, expect, it } from 'vitest'

import {
  validateCheckCreate,
  validateHeartbeat,
  validateWorkerResult,
} from '#core/checkValidation.ts'

const RESULT = { status: 'done', error: null, durationMs: 1000, usage: null, reply: null }

describe('validateCheckCreate', () => {
  it('keeps distinct ids in request order', () => {
    expect(validateCheckCreate({ findingIds: [3, 1, 3] })).toEqual({
      ok: true,
      value: { findingIds: [3, 1] },
    })
  })

  it('names missing, invalid and too many ids', () => {
    expect(validateCheckCreate({})).toMatchObject({ errors: [{ code: 'required' }] })
    expect(validateCheckCreate({ findingIds: [] })).toMatchObject({
      errors: [{ code: 'required' }],
    })
    expect(validateCheckCreate({ findingIds: [1.5] })).toMatchObject({
      errors: [{ code: 'invalid' }],
    })
    expect(
      validateCheckCreate({ findingIds: Array.from({ length: 101 }, (_, i) => i + 1) }),
    ).toMatchObject({ errors: [{ code: 'too_many' }] })
  })
})

describe('validateHeartbeat', () => {
  it('accepts the known phases only', () => {
    expect(validateHeartbeat({ phase: 'reporting' })).toEqual({
      ok: true,
      value: { phase: 'reporting' },
    })
    expect(validateHeartbeat({})).toMatchObject({ errors: [{ field: 'phase', code: 'required' }] })
    expect(validateHeartbeat({ phase: 'idle' })).toMatchObject({ errors: [{ code: 'invalid' }] })
  })
})

describe('validateWorkerResult', () => {
  it('caps the reply at 4000 and the error at 500 characters', () => {
    const result = validateWorkerResult({
      ...RESULT,
      status: 'failed',
      error: 'e'.repeat(600),
      reply: 'r'.repeat(5000),
    })

    expect(result.ok && result.value.reply?.length).toBe(4000)
    expect(result.ok && result.value.error?.length).toBe(500)
  })

  it('drops the error of a done result and names a failure without reason', () => {
    expect(validateWorkerResult({ ...RESULT, error: 'ignored' })).toMatchObject({
      value: { error: null },
    })
    expect(validateWorkerResult({ ...RESULT, status: 'failed' })).toMatchObject({
      value: { error: 'The worker reported a failure without a reason.' },
    })
  })

  it('reads the usage and refuses malformed counts', () => {
    const usage = {
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: 3,
      cacheCreationTokens: 4,
      costUsd: null,
      turns: 5,
      extra: 'dropped',
    }

    const { extra: _extra, ...known } = usage
    const result = validateWorkerResult({ ...RESULT, usage })

    expect(result.ok && result.value.usage).toEqual(known)
    expect(validateWorkerResult({ ...RESULT, usage: { ...usage, turns: -1 } })).toMatchObject({
      errors: [{ field: 'usage.turns' }],
    })
    expect(validateWorkerResult({ ...RESULT, usage: { ...usage, costUsd: 'free' } })).toMatchObject(
      { errors: [{ field: 'usage.costUsd' }] },
    )
  })

  it('reads, cleans and caps the models of a usage and accepts none', () => {
    const usage = {
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: 3,
      cacheCreationTokens: 4,
      costUsd: null,
      turns: 5,
    }
    const models = ['opus', 'opus', 'bad id', 7, 'x'.repeat(101), ...'abcdefghij'.split('')]
    const result = validateWorkerResult({ ...RESULT, usage: { ...usage, models } })

    expect(result.ok && result.value.usage?.models).toEqual([
      'opus',
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
    ])
    expect(validateWorkerResult({ ...RESULT, usage })).toMatchObject({ value: { usage } })
    expect(validateWorkerResult({ ...RESULT, usage: { ...usage, models: 'opus' } })).toMatchObject({
      ok: true,
    })
  })

  it('needs a status and a duration', () => {
    expect(validateWorkerResult({ durationMs: 1 })).toMatchObject({
      errors: [{ field: 'status', code: 'required' }],
    })
    expect(validateWorkerResult({ status: 'done' })).toMatchObject({
      errors: [{ field: 'durationMs', code: 'required' }],
    })
  })
  it('reads an optional pulled digest and refuses other text', () => {
    const digest = `sha256:${'d'.repeat(64)}`

    expect(validateWorkerResult(RESULT)).toMatchObject({ value: { pulledDigest: null } })
    expect(validateWorkerResult({ ...RESULT, pulledDigest: digest })).toMatchObject({
      value: { pulledDigest: digest },
    })
    expect(validateWorkerResult({ ...RESULT, pulledDigest: 'latest' })).toMatchObject({
      errors: [{ field: 'pulledDigest', code: 'invalid' }],
    })
  })

  it('reads pulledDigests distinct and cut to three, and from pulledDigest of an older worker', () => {
    const [c, d, e, f] = ['c', 'd', 'e', 'f'].map((hex) => `sha256:${hex.repeat(64)}`)

    expect(validateWorkerResult(RESULT)).toMatchObject({ value: { pulledDigests: [] } })
    expect(validateWorkerResult({ ...RESULT, pulledDigest: c })).toMatchObject({
      value: { pulledDigest: c, pulledDigests: [c] },
    })
    expect(
      validateWorkerResult({ ...RESULT, pulledDigest: c, pulledDigests: [c, d, d, e, f] }),
    ).toMatchObject({ value: { pulledDigest: c, pulledDigests: [c, d, e] } })
    expect(validateWorkerResult({ ...RESULT, pulledDigests: [d, c] })).toMatchObject({
      value: { pulledDigest: d, pulledDigests: [d, c] },
    })
    for (const pulledDigests of ['x', [c, 'latest'], [c, 42]]) {
      expect(validateWorkerResult({ ...RESULT, pulledDigests })).toMatchObject({
        errors: [{ field: 'pulledDigests', code: 'invalid' }],
      })
    }
    expect(validateWorkerResult({ ...RESULT, pulledDigest: c, pulledDigests: [d] })).toMatchObject({
      errors: [{ field: 'pulledDigests', code: 'invalid' }],
    })
  })

  it('counts reply and error in code points like the database', () => {
    const result = validateWorkerResult({ ...RESULT, reply: '😀'.repeat(4001) })

    expect(result.ok && Array.from(result.value.reply ?? '').length).toBe(4000)
  })
})
