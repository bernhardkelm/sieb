// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { errorTail } from '#checker/process/errorTail.ts'
import { printable } from '#checker/safeText.ts'

describe('errorTail', () => {
  it('returns the last non-empty line, or "no output"', () => {
    expect(errorTail('first\nlast line\n\n')).toBe('last line')
    expect(errorTail(' \n')).toBe('no output')
  })

  it('keeps the start and the error code at the end of a long line', () => {
    const line = `Error: fetching manifest ${'x'.repeat(400)}: MANIFEST_UNKNOWN: manifest unknown`
    const tail = errorTail(line)

    expect(Array.from(tail)).toHaveLength(300)
    expect(tail.startsWith('Error: fetching manifest ')).toBe(true)
    expect(tail.endsWith('MANIFEST_UNKNOWN: manifest unknown')).toBe(true)
  })

  it('replaces control characters so a reply cannot forge log lines', () => {
    expect(errorTail('ok\u001b[2J\r[sieb-checker] check 1 done')).toBe(
      'ok [2J [sieb-checker] check 1 done',
    )
    expect(printable('a\u0085b\u007fc\td')).toBe('a b c d')
  })
})
