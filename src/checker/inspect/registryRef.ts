import { isInternalHostName } from '#core/internalHostNames.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/registryHost.ts'

/** A validated image reference for an anonymous crane call */
export interface RegistryRef {
  host: string // registry host, docker.io for Docker Hub
  repository: string // host/path without tag or digest
  ref: string // repository with its tag or digest, what crane reads
}

export const MAX_REF_LENGTH = 300

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
const HOST = new RegExp(`^${LABEL}(?:\\.${LABEL})+$`, 'u')
const COMPONENT = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/u
const TAG = /^[\w][\w.-]{0,127}$/u
const DIGEST = /^sha256:[a-f0-9]{64}$/u
const PLATFORM = /^[a-z0-9]{1,16}\/[a-z0-9]{1,16}(?:\/[a-z0-9]{1,16})?$/u

/**
 * Splits the tag or digest off a reference.
 * @param {string} text - Reference
 * @returns {{ name: string; tag: string | null; digest: string | null }} - Name and suffixes
 */
const splitSuffix = (text: string): { name: string; tag: string | null; digest: string | null } => {
  const at = text.indexOf('@')
  const named = at === -1 ? text : text.slice(0, at)
  const digest = at === -1 ? null : text.slice(at + 1)
  const colon = named.lastIndexOf(':')
  const hasTag = colon > named.lastIndexOf('/')

  return {
    name: hasTag ? named.slice(0, colon) : named,
    tag: hasTag ? named.slice(colon + 1) : null,
    digest,
  }
}

/**
 * Validates an image reference for the registry tools: only lower-case repository names, a
 * registry host that is a public DNS name on the list of public registries (Docker Hub when the
 * reference names none, official images under library/), no port, IP address or option syntax.
 * @param {string} input - Reference as Claude wrote it
 * @param {'none' | 'required'} suffix - Whether a tag or digest is refused or required
 * @returns {RegistryRef} - Canonical reference
 * @throws {Error} - When the reference is not accepted, with the reason
 */
export const parseRegistryRef = (input: string, suffix: 'none' | 'required'): RegistryRef => {
  const text = input.trim()

  if (text === '' || text.length > MAX_REF_LENGTH || text.startsWith('-')) {
    throw new Error(`the reference must be 1 to ${MAX_REF_LENGTH} characters and not start with -`)
  }

  const { name, tag, digest } = splitSuffix(text)
  const parts = name.split('/')
  const first = parts[0] ?? ''
  const explicit = parts.length > 1 && (first.includes('.') || first.includes(':'))
  const host = explicit ? first : 'docker.io'
  const path = explicit ? parts.slice(1) : parts

  if (!HOST.test(host) || isInternalHostName(host) || /^[\d.]+$/u.test(host)) {
    throw new Error('the registry host must be a public DNS name without port')
  }

  if (!DEFAULT_PUBLIC_REGISTRIES.includes(host)) {
    throw new Error(`the registry tools reach only ${DEFAULT_PUBLIC_REGISTRIES.join(', ')}`)
  }

  if (path.length === 0 || !path.every((component) => COMPONENT.test(component))) {
    throw new Error(
      'the repository path must be lower case: letters, digits and . _ - between them',
    )
  }

  if ((tag !== null && !TAG.test(tag)) || (digest !== null && !DIGEST.test(digest))) {
    throw new Error(
      'the tag must be up to 128 of letters, digits and _ . -, a digest sha256:<64 hex>',
    )
  }

  const hasSuffix = tag !== null || digest !== null

  if (hasSuffix !== (suffix === 'required')) {
    throw new Error(suffix === 'required' ? 'add a tag or a digest' : 'leave out tag and digest')
  }

  const hub = host === 'docker.io' || host.endsWith('.docker.io')
  const repository = `${host}/${[...(hub && path.length === 1 ? ['library'] : []), ...path].join('/')}`
  const ref = `${repository}${tag === null ? '' : `:${tag}`}${digest === null ? '' : `@${digest}`}`

  return { host, repository, ref }
}

/**
 * Validates a platform such as linux/arm64 or linux/arm/v7.
 * @param {string} platform - Platform as Claude wrote it
 * @returns {string} - Platform
 * @throws {Error} - When it is no os/architecture[/variant]
 */
export const parsePlatform = (platform: string): string => {
  if (!PLATFORM.test(platform)) {
    throw new Error('the platform must be os/architecture or os/architecture/variant, lower case')
  }

  return platform
}
