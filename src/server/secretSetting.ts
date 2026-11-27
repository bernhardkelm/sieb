import { readFileSync } from 'node:fs'

/** Reads a mounted secret file, replaced in tests */
export type ReadSecretFile = (path: string) => string

/**
 * Reads a secret setting from the file named by <name>_FILE, else from the variable itself. A
 * mounted file keeps the secret out of the process environment.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {string} name - Variable name, the file variable is <name>_FILE
 * @param {ReadSecretFile} readFile - Reads the file
 * @returns {string | null} - Trimmed value, null when neither variable is set
 * @throws {Error} - When both are set or the file cannot be read, never with the value in the message
 */
export const readSecretSetting = (
  env: Record<string, string | undefined>,
  name: string,
  readFile: ReadSecretFile = (path) => readFileSync(path, 'utf8'),
): string | null => {
  const fileName = `${name}_FILE`
  const file = env[fileName]?.trim()
  const direct = env[name]?.trim()

  if (file && direct) {
    throw new Error(`set ${name} or ${fileName}, not both`)
  }

  if (!file) {
    return direct || null
  }

  try {
    return readFile(file).trim() || null
  } catch (error) {
    throw new Error(
      `${fileName} cannot be read (${(error as NodeJS.ErrnoException).code ?? 'unreadable'})`,
    )
  }
}
