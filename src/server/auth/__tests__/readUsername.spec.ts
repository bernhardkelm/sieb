// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readUsername } from '#server/auth/readUsername.ts'

describe('readUsername', () => {
  it.each([
    [' alice ', 'alice'],
    ['a.b-c_d@example.com', 'a.b-c_d@example.com'],
    ['x'.repeat(256), 'x'.repeat(256)],
    ['Jürgen', 'Jürgen'],
  ])('accepts %j as %j', (raw, expected) => {
    expect(readUsername(raw)).toBe(expected)
  })

  it.each([
    undefined,
    null,
    42,
    '',
    '   ',
    'x'.repeat(257),
    'ali\nce',
    'ali\u0000ce',
    'ali​ce',
    'ali‮ce',
    'al­ice',
  ])('refuses %j', (raw) => {
    expect(readUsername(raw)).toBeNull()
  })
})
