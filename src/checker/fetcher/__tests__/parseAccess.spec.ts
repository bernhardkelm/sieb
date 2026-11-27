// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { parseFetchAccess, parseSourceAnswer } from '#checker/fetcher/parseAccess.ts'

const LOGIN = { host: 'ghcr.io', username: 'bot', secret: 'ghp_secret' }
const DIGEST = `sha256:${'a'.repeat(64)}`
const IMAGES = [{ imageRef: `ghcr.io/acme/app@${DIGEST}`, imageDigest: DIGEST, tag: '1.0' }]
const GRANT = {
  repoUrl: 'https://GitHub.com/acme/app',
  revision: null,
  username: 'x-access-token',
  secret: 'ghp_secret',
}

describe('parseFetchAccess', () => {
  it('accepts logins with the image list', () => {
    expect(parseFetchAccess({ registries: [LOGIN], images: IMAGES })).toEqual({
      registries: [LOGIN],
      images: IMAGES,
    })
    expect(parseFetchAccess({ registries: [], images: IMAGES })).toEqual({
      registries: [],
      images: IMAGES,
    })
  })

  it('keeps a single-line label of a login and drops any other', () => {
    const parsed = parseFetchAccess({
      registries: [
        { ...LOGIN, label: 'Team GHCR' },
        { ...LOGIN, host: 'a.example.com', label: 'two\nlines' },
        { ...LOGIN, host: 'b.example.com', label: 'x'.repeat(65) },
      ],
      images: IMAGES,
    })

    expect(parsed.registries).toEqual([
      { ...LOGIN, label: 'Team GHCR' },
      { ...LOGIN, host: 'a.example.com' },
      { ...LOGIN, host: 'b.example.com' },
    ])
  })

  it('refuses an answer without image list, so only sieb names what is pulled', () => {
    for (const images of [undefined, null, [], 'x']) {
      expect(() => parseFetchAccess({ registries: [LOGIN], images })).toThrow('invalid image list')
    }
  })

  it('refuses logins that could split a config or a header, without echoing them', () => {
    for (const login of [
      { ...LOGIN, secret: 'a b' },
      { ...LOGIN, secret: 'a\nb' },
      { ...LOGIN, username: 'a:b' },
      { ...LOGIN, host: 'ghcr.io/evil' },
    ]) {
      expect(() => parseFetchAccess({ registries: [login], images: IMAGES })).toThrow(
        /^sieb sent an invalid registry access answer$/,
      )
    }

    expect(() => parseFetchAccess({ registries: [], images: [{ imageRef: '-x:1' }] })).toThrow(
      'invalid image list',
    )
  })
})

describe('parseSourceAnswer', () => {
  it('normalises the repository URL and keeps only full commit ids', () => {
    expect(parseSourceAnswer({ grant: GRANT })).toEqual({
      grant: { ...GRANT, repoUrl: 'https://github.com/acme/app' },
    })
    expect(parseSourceAnswer({ grant: { ...GRANT, revision: 'ABCDEF1' } })).toMatchObject({
      grant: { revision: null },
    })
    expect(parseSourceAnswer({ grant: { ...GRANT, revision: 'A'.repeat(40) } })).toMatchObject({
      grant: { revision: 'a'.repeat(40) },
    })
    expect(parseSourceAnswer({ skip: 'no_repository' })).toEqual({ skip: 'no_repository' })
  })

  it('refuses URLs with credentials, other schemes and malformed logins', () => {
    for (const grant of [
      { ...GRANT, repoUrl: 'https://u:p@github.com/acme/app' },
      { ...GRANT, repoUrl: 'http://github.com/acme/app' },
      { ...GRANT, repoUrl: 'ext::sh -c id' },
      { ...GRANT, repoUrl: 'https://github.com/acme/app?x=1' },
      { ...GRANT, secret: 'a\r\nX-Evil: 1' },
    ]) {
      expect(() => parseSourceAnswer({ grant })).toThrow(/^sieb sent an invalid source answer$/)
    }

    expect(() => parseSourceAnswer({ skip: 'whatever' })).toThrow('invalid source answer')
  })
})
