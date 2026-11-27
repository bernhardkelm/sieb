/** readelf views by mode, all in wide output */
export const READELF_MODES = {
  header: ['-h'],
  sections: ['-S', '-W'],
  segments: ['-l', '-W'],
  dynamic: ['-d', '-W'],
  symbols: ['-s', '-W'],
  dynamic_symbols: ['--dyn-syms', '-W'],
  notes: ['-n', '-W'],
  versions: ['-V', '-W'],
} as const

/** objdump views by mode, disassemble_symbol needs a symbol */
export const OBJDUMP_MODES = ['private_headers', 'section_headers', 'disassemble_symbol'] as const

export type ReadelfMode = keyof typeof READELF_MODES
export type ObjdumpMode = (typeof OBJDUMP_MODES)[number]

/** Symbol names objdump may disassemble, no option syntax possible */
export const SYMBOL_PATTERN = /^[A-Za-z_.$][A-Za-z0-9_.$@]{0,199}$/

// jq builtins and variables that read the environment, files or module search paths
const JQ_FORBIDDEN =
  /\b(import|include|env|input_filename|get_search_list|modulemeta|get_prog_origin|get_jq_origin)\b|\$ENV|\$__loc__|\$__prog/

/**
 * Builds the strings arguments: all sections, a minimum string length.
 * @param {string} path - Resolved file
 * @param {number} minLength - Minimum string length
 * @returns {string[]} - Arguments
 */
export const stringsArgs = (path: string, minLength: number): string[] => [
  '-a',
  '-n',
  String(minLength),
  path,
]

/**
 * Builds the readelf arguments of a mode.
 * @param {string} path - Resolved file
 * @param {ReadelfMode} mode - View
 * @returns {string[]} - Arguments
 */
export const readelfArgs = (path: string, mode: ReadelfMode): string[] => [
  ...READELF_MODES[mode],
  path,
]

/**
 * Builds the objdump arguments of a mode.
 * @param {string} path - Resolved file
 * @param {ObjdumpMode} mode - View
 * @param {string | undefined} symbol - Symbol to disassemble
 * @returns {string[]} - Arguments
 * @throws {Error} - When disassemble_symbol lacks a valid symbol
 */
export const objdumpArgs = (
  path: string,
  mode: ObjdumpMode,
  symbol: string | undefined,
): string[] => {
  if (mode === 'private_headers') {
    return ['-p', path]
  }

  if (mode === 'section_headers') {
    return ['-h', '-w', path]
  }

  if (!symbol || !SYMBOL_PATTERN.test(symbol)) {
    throw new Error('disassemble_symbol needs a symbol of letters, digits and _ . $ @')
  }

  return ['-d', '--no-show-raw-insn', `--disassemble=${symbol}`, path]
}

/**
 * Builds the unzip arguments that list an archive without extracting it.
 * @param {string} path - Resolved file
 * @returns {string[]} - Arguments
 */
export const unzipArgs = (path: string): string[] => ['-l', path]

/**
 * Builds the jq arguments after checking the filter.
 * @param {string} path - Resolved JSON file
 * @param {string} filter - jq filter
 * @returns {string[]} - Arguments, the filter after "--" so it is never read as an option
 * @throws {Error} - When the file is no .json file or the filter reaches the environment, files or modules
 */
export const jqArgs = (path: string, filter: string): string[] => {
  if (!/\.json$/i.test(path)) {
    throw new Error('jq reads only .json files')
  }

  if (JQ_FORBIDDEN.test(filter)) {
    throw new Error('the filter must not use import, include, env, $ENV or input_filename')
  }

  return ['-M', '--', filter, path]
}
