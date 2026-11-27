import type { EntryKind } from '#checker/tar/tarEntry.ts'

// files ripgrep honours, they would hide image files from Claude's Grep
const IGNORE_FILE_NAMES = new Set(['.gitignore', '.ignore', '.rgignore'])
const GIT_EXCLUDE_SUFFIX = '.git/info/exclude'

/**
 * Normalizes an entry path relative to the extraction root.
 * @param {string} raw - Path from the archive
 * @returns {string | null} - Path without "." segments, "" for the root, null when absolute or with ".."
 */
export const normalizeEntryPath = (raw: string): string | null => {
  if (raw.startsWith('/') || raw.includes('\0')) {
    return null
  }

  const segments = raw.split('/').filter((segment) => segment !== '' && segment !== '.')

  return segments.includes('..') ? null : segments.join('/')
}

/**
 * Returns whether a path or one of its parents was extracted as a symlink.
 * @param {string} path - Normalized path
 * @param {Set<string>} symlinks - Extracted symlink paths
 * @returns {boolean} - Whether writing the path would follow a symlink
 */
export const underSymlink = (path: string, symlinks: Set<string>): boolean => {
  const segments = path.split('/')

  return segments.some((_, index) => symlinks.has(segments.slice(0, index + 1).join('/')))
}

/**
 * Returns whether an entry is a file that makes ripgrep skip other files.
 * @param {string} path - Normalized path
 * @param {EntryKind} kind - Entry kind
 * @returns {boolean} - Whether it is an ignore file or a git exclude file
 */
export const isIgnoreFile = (path: string, kind: EntryKind): boolean =>
  kind !== 'directory' &&
  (IGNORE_FILE_NAMES.has(path.slice(path.lastIndexOf('/') + 1)) ||
    path === GIT_EXCLUDE_SUFFIX ||
    path.endsWith(`/${GIT_EXCLUDE_SUFFIX}`))
