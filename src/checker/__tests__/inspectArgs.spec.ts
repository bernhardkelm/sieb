// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  jqArgs,
  objdumpArgs,
  readelfArgs,
  stringsArgs,
  unzipArgs,
} from '#checker/inspect/inspectArgs.ts'

const FILE = '/work/check-7/workspace/image/usr/bin/curl'

describe('inspect arguments', () => {
  it('builds strings, readelf and unzip arguments from fixed flags and the resolved path', () => {
    expect(stringsArgs(FILE, 8)).toEqual(['-a', '-n', '8', FILE])
    expect(readelfArgs(FILE, 'dynamic')).toEqual(['-d', '-W', FILE])
    expect(readelfArgs(FILE, 'notes')).toEqual(['-n', '-W', FILE])
    expect(readelfArgs(FILE, 'dynamic_symbols')).toEqual(['--dyn-syms', '-W', FILE])
    expect(unzipArgs('/w/app.jar')).toEqual(['-l', '/w/app.jar'])
  })

  it('builds objdump arguments and validates the symbol', () => {
    expect(objdumpArgs(FILE, 'private_headers', undefined)).toEqual(['-p', FILE])
    expect(objdumpArgs(FILE, 'section_headers', undefined)).toEqual(['-h', '-w', FILE])
    expect(objdumpArgs(FILE, 'disassemble_symbol', 'SSL_read')).toEqual([
      '-d',
      '--no-show-raw-insn',
      '--disassemble=SSL_read',
      FILE,
    ])
    for (const symbol of [undefined, '', '-M intel', 'a b', 'x;rm', '$(id)']) {
      expect(() => objdumpArgs(FILE, 'disassemble_symbol', symbol)).toThrow(
        'disassemble_symbol needs a symbol',
      )
    }
  })

  it('puts the jq filter after -- and refuses environment, file and module access', () => {
    expect(jqArgs('/w/inventory.json', '-r .artifacts[].name')).toEqual([
      '-M',
      '--',
      '-r .artifacts[].name',
      '/w/inventory.json',
    ])
    for (const filter of [
      '$ENV.PATH',
      'env',
      'import "a" as a; .',
      'include "x"; .',
      'input_filename',
    ]) {
      expect(() => jqArgs('/w/inventory.json', filter)).toThrow('the filter must not use')
    }
    expect(() => jqArgs('/w/image/etc/passwd', '.')).toThrow('jq reads only .json files')
  })
})
