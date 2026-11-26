// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readConfig } from '#server/config.ts'
import { sourceCodeUrlOf } from '#server/sourceCodeUrl.ts'

const CWD = '/srv/sieb'

describe('source code link', () => {
  it('links the upstream tree of the version tag without an override', () => {
    expect(readConfig({}, CWD).sourceCodeUrl).toBeNull()
    expect(readConfig({ SIEB_SOURCE_URL: '  ' }, CWD).sourceCodeUrl).toBeNull()
    expect(sourceCodeUrlOf('0.2.1', null)).toBe('https://github.com/bernhardkelm/sieb/tree/0.2.1')
  })

  it('takes the link of a fork from SIEB_SOURCE_URL', () => {
    const config = readConfig({ SIEB_SOURCE_URL: ' https://git.example.com/acme/sieb ' }, CWD)

    expect(config.sourceCodeUrl).toBe('https://git.example.com/acme/sieb')
    expect(sourceCodeUrlOf('0.2.1', config.sourceCodeUrl)).toBe('https://git.example.com/acme/sieb')
  })

  it('rejects a SIEB_SOURCE_URL that is not http or https', () => {
    expect(() => readConfig({ SIEB_SOURCE_URL: 'javascript:alert(1)' }, CWD)).toThrow(
      'SIEB_SOURCE_URL must be an http or https URL',
    )
    expect(() => readConfig({ SIEB_SOURCE_URL: 'not a url' }, CWD)).toThrow('SIEB_SOURCE_URL')
  })
})
