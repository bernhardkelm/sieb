import { readFileSync } from 'node:fs'

/** Reads a mounted secret file, replaced in tests */
export type ReadSecretFile = (path: string) => string

// printable ASCII without spaces, so a secret cannot smuggle a header or a second line
const SECRET_PATTERN = /^[\x21-\x7e]{1,4096}$/

/** Reads a secret file as UTF-8 */
export const readSecretFile: ReadSecretFile = (path) => readFileSync(path, 'utf8')

/**
 * Validates the shape of a secret without echoing it.
 * @param {string} value - Trimmed secret
 * @param {string} name - Variable name for the error message
 * @returns {string} - The secret
 * @throws {Error} - When it is empty or contains whitespace or control characters
 */
const checked = (value: string, name: string): string => {
  if (!SECRET_PATTERN.test(value)) {
    throw new Error(`${name} must be one line of printable characters without spaces`)
  }

  return value
}

/**
 * Reads a secret from the file named by <name>_FILE, else from the variable itself. A mounted
 * file keeps the secret out of the process environment and so out of /proc/<pid>/environ.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {string} name - Variable name, the file variable is <name>_FILE
 * @param {ReadSecretFile} readFile - Reads the file
 * @returns {string | null} - Trimmed secret, null when neither variable is set
 * @throws {Error} - When both are set, the file cannot be read or the secret is malformed
 */
export const secretValue = (
  env: Record<string, string | undefined>,
  name: string,
  readFile: ReadSecretFile = readSecretFile,
): string | null => {
  const fileName = `${name}_FILE`
  const file = env[fileName]?.trim()
  const direct = env[name]?.trim()

  if (file && direct) {
    throw new Error(`set ${name} or ${fileName}, not both`)
  }

  if (!file) {
    return direct ? checked(direct, name) : null
  }

  let content: string

  try {
    content = readFile(file).trim()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? 'unreadable'

    throw new Error(`${fileName} cannot be read (${code})`)
  }

  return checked(content, fileName)
}
