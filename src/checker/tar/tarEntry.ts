import type { RawHeader } from '#checker/tar/tarHeader.ts'
import type { HeaderOverrides } from '#checker/tar/tarPax.ts'
import { isIgnoreFile, normalizeEntryPath, underSymlink } from '#checker/tar/tarPaths.ts'

export type EntryKind = 'file' | 'hardlink' | 'symlink' | 'directory'

/** Why an entry was left out of the extraction */
export type DropReason =
  | 'unsafe_path'
  | 'special_file'
  | 'under_symlink'
  | 'link_target'
  | 'ignore_file'

/** An entry that is extracted, with the fields its fresh header carries */
export interface TarEntry {
  kind: EntryKind
  path: string
  linkpath: string
  mode: number
  size: number
  mtime: number
}

/** Paths extracted so far, needed to judge later entries */
export interface SeenPaths {
  extracted: Map<string, EntryKind>
  symlinks: Set<string> // symlinks and hard links to them, nothing is extracted below these
}

export type Classified = { entry: TarEntry } | { drop: DropReason | null }

const KINDS: Record<string, EntryKind> = {
  '0': 'file',
  '\0': 'file',
  '7': 'file',
  '1': 'hardlink',
  '2': 'symlink',
  '5': 'directory',
}
// link, symlink, devices, directory and fifo carry no data blocks
const HEADER_ONLY = new Set(['1', '2', '3', '4', '5', '6'])
const MAX_MTIME = 0o77777777777

/**
 * Returns the number of data bytes that follow a header in the input.
 * @param {RawHeader} header - Parsed header
 * @param {HeaderOverrides} overrides - Pax overrides of this entry
 * @returns {number} - Unpadded data size
 */
export const dataSize = (header: RawHeader, overrides: HeaderOverrides): number =>
  HEADER_ONLY.has(header.typeflag) ? 0 : (overrides.size ?? header.size)

/**
 * Returns the target of a hard link when it may be extracted: an extracted file or symlink, not
 * a directory, which GNU tar cannot link.
 * @param {string} raw - Link target from the archive
 * @param {SeenPaths} seen - Paths extracted so far
 * @returns {{ target: string, kind: EntryKind } | null} - Normalized target and its kind
 */
const hardlinkTarget = (
  raw: string,
  seen: SeenPaths,
): { target: string; kind: EntryKind } | null => {
  const target = normalizeEntryPath(raw)
  const kind = target ? seen.extracted.get(target) : undefined

  return target && kind && kind !== 'directory' ? { target, kind } : null
}

/**
 * Returns the mode the extracted entry gets: no setuid, setgid or sticky bits, owner writable.
 * @param {EntryKind} kind - Entry kind
 * @param {number} mode - Mode from the archive
 * @returns {number} - Normalized mode
 */
const entryMode = (kind: EntryKind, mode: number): number => {
  if (kind === 'directory' || kind === 'symlink') {
    return kind === 'directory' ? 0o755 : 0o777
  }

  return mode & 0o111 ? 0o755 : 0o644
}

/**
 * Decides whether an entry is extracted and records it in the seen paths.
 * @param {RawHeader} header - Parsed header
 * @param {HeaderOverrides} overrides - Pax or GNU long-name overrides of this entry
 * @param {SeenPaths} seen - Paths extracted so far, changed in place
 * @returns {Classified} - The entry to write, or the reason it is dropped (null for the root entry)
 */
export const classifyEntry = (
  header: RawHeader,
  overrides: HeaderOverrides,
  seen: SeenPaths,
): Classified => {
  const kind = KINDS[header.typeflag]
  const path = normalizeEntryPath(overrides.path ?? header.name)

  if (!kind) {
    return { drop: 'special_file' }
  }

  if (path === null) {
    return { drop: 'unsafe_path' }
  }

  if (path === '') {
    return { drop: null }
  }

  if (underSymlink(path, seen.symlinks)) {
    return { drop: 'under_symlink' }
  }

  if (isIgnoreFile(path, kind)) {
    return { drop: 'ignore_file' }
  }

  let linkpath = ''

  if (kind === 'hardlink') {
    const link = hardlinkTarget(overrides.linkpath ?? header.linkname, seen)

    if (!link) {
      return { drop: 'link_target' }
    }

    linkpath = link.target
    // a hard link to a symlink is that symlink, nothing may be extracted below it either
    if (link.kind === 'symlink') {
      seen.symlinks.add(path)
    }
  } else if (kind === 'symlink') {
    linkpath = overrides.linkpath ?? header.linkname

    if (!linkpath || linkpath.includes('\0')) {
      return { drop: 'link_target' }
    }

    seen.symlinks.add(path)
  }

  seen.extracted.set(path, kind === 'hardlink' ? (seen.extracted.get(linkpath) ?? kind) : kind)

  return {
    entry: {
      kind,
      path,
      linkpath,
      mode: entryMode(kind, header.mode),
      size: kind === 'file' ? dataSize(header, overrides) : 0,
      mtime: Math.min(Math.max(header.mtime, 0), MAX_MTIME),
    },
  }
}
