import { join } from 'node:path'

/** Absolute path of the inspect server entry point, started by Claude Code as a stdio server */
export const INSPECT_ENTRY = join(import.meta.dirname, 'inspectMain.ts')
