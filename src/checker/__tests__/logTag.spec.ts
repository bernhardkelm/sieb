// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'

import { logTag, setLogProcess } from '#checker/logTag.ts'

describe('logTag', () => {
  afterEach(() => {
    setLogProcess('sieb-checker')
  })

  it('names the checker by default and the fetcher once it set its name', () => {
    expect(logTag()).toBe('[sieb-checker]')

    setLogProcess('sieb-fetcher')

    expect(logTag()).toBe('[sieb-fetcher]')
  })
})
