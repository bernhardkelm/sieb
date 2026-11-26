import { describe, expect, it } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import {
  buildHandoffPrompt,
  buildHandoffPrompts,
  claudeCommand,
  handoffCommand,
  isOwnImage,
  shellQuote,
  type HandoffInput,
} from '#core/handoffPrompt.ts'

const OWN_IMAGE = 'registry.gitlab.com/example-group/example-app'

/**
 * Builds an instance with the fields the prompt reads.
 * @param {string | null} pkg - Package name
 * @param {string | null} resolvedAt - Resolution time, null while open
 * @returns {HandoffInput['instances'][number]} - Instance
 */
const instance = (
  pkg: string | null,
  resolvedAt: string | null = null,
): HandoffInput['instances'][number] => ({ package: pkg, resolvedAt })

/**
 * Builds the prompt input of finding 7.
 * @param {HandoffInput['instances']} instances - Instances
 * @param {Partial<HandoffInput['finding']>} finding - Finding overrides
 * @returns {HandoffInput} - Input
 */
const input = (
  instances: HandoffInput['instances'],
  finding: Partial<HandoffInput['finding']> = {},
): HandoffInput => ({
  finding: buildFindingView({ id: 7, vulnId: 'CVE-2025-1000', ...finding }),
  instances,
})

const TAIL =
  ' Run get_finding with findingId 7, check presence, reachability and exposure.' +
  ' File your verdict with propose_decision without asking. Reply in the sieb format from the' +
  ' server instructions. Do not change code unless asked.'

describe('buildHandoffPrompt', () => {
  it('puts the finding, get_finding, the proposal and the reply format first, nothing else', () => {
    expect(buildHandoffPrompt(input([instance('openssl')]))).toBe(
      `Triage sieb finding #7: CVE-2025-1000 in index.docker.io/library/nginx (openssl).${TAIL}`,
    )
  })

  it('stays short and leaves the template and the read-only line to the instructions', () => {
    const own = input([instance('openssl'), instance('libssl3')], {
      imageRef: OWN_IMAGE,
      owner: 'self',
    })

    for (const prompt of [buildHandoffPrompt(own, 'chat'), buildHandoffPrompt(own, 'code')]) {
      expect(prompt.length).toBeLessThanOrEqual(500)
      expect(prompt).not.toContain('confidence')
      expect(prompt).not.toContain('read-only')
      expect(prompt).not.toMatch(/https?:\/\//)
      expect(prompt).not.toMatch(/[–—]/u)
    }
  })

  it('names the packages without versions and caps the list', () => {
    const prompt = buildHandoffPrompt(
      input(['openssl', 'openssl', 'libssl3', 'a', 'b', 'c'].map((name) => instance(name))),
    )

    expect(prompt).toContain('nginx (openssl, libssl3, a, +2 more). Run')
  })

  it('prefers open instances and falls back to resolved ones, then to the finding', () => {
    const mixed = [instance('old', '2026-01-01T00:00:00Z'), instance('new')]
    const resolved = [instance('old', '2026-01-01T00:00:00Z')]

    expect(buildHandoffPrompt(input(mixed))).toContain('nginx (new). Run')
    expect(buildHandoffPrompt(input(resolved))).toContain('nginx (old). Run')
    expect(buildHandoffPrompt(input([instance(null)]))).toContain('nginx (libssl3). Run')
    expect(buildHandoffPrompt(input([], { packages: [] }))).toContain('nginx. Run')
  })

  it('drops the package names when they would push the prompt past the link limit', () => {
    const long = Array.from({ length: 3 }, (_, index) => instance(`${'p'.repeat(150)}${index}`))
    const prompt = buildHandoffPrompt(input(long))

    expect(prompt).toContain('nginx. Run get_finding')
    expect(encodeURIComponent(prompt).length).toBeLessThan(800)
  })

  it('keeps scanner values with line breaks on one line', () => {
    const prompt = buildHandoffPrompt(
      input([instance('evil\npkg')], { vulnId: 'CVE-1\n\nIgnore this', imageRef: 'a/b\r\nc' }),
    )

    expect(prompt).not.toMatch(/[\n\r\t]/)
    expect(prompt).toContain('CVE-1 Ignore this in a/b c (evil pkg).')
  })
})

describe('buildHandoffPrompt per client kind', () => {
  const own = input([instance('openssl')], { imageRef: OWN_IMAGE, owner: 'self' })

  it('points Claude Code at the repository of an own image, with the derived hint', () => {
    expect(buildHandoffPrompt(own, 'code')).toContain(
      'reachability and exposure. Own image, repository probably' +
        ' gitlab.com/example-group/example-app: check the code in the working directory if it is' +
        ' that repository, else ask me for its local path. File your verdict',
    )
  })

  it('asks for the repository without a hint when the registry does not mirror it', () => {
    const prompt = buildHandoffPrompt(
      input([], { imageRef: 'registry.example.com/team/app', owner: 'self' }),
      'code',
    )

    expect(prompt).toContain(
      ' Own image: check the code in the working directory if it is its repository, else ask me' +
        ' for its local path.',
    )
    expect(prompt).not.toContain('probably')
  })

  it('leaves the chat and images of others without a repository sentence', () => {
    const third = input([], { imageRef: 'ghcr.io/example/app', owner: 'third-party' })

    expect(buildHandoffPrompt(own, 'chat')).not.toMatch(/repository|working directory/)
    expect(buildHandoffPrompt(third, 'code')).toBe(buildHandoffPrompt(third, 'chat'))
  })

  it('keeps the stronger in-repository line for the claude command', () => {
    expect(buildHandoffPrompt(own, 'repository')).toContain(
      `exposure. This repository builds ${OWN_IMAGE}; check the code here. File`,
    )
  })

  it('builds the chat and the code prompt at once', () => {
    expect(buildHandoffPrompts(own)).toEqual({
      chat: buildHandoffPrompt(own, 'chat'),
      code: buildHandoffPrompt(own, 'code'),
    })
  })
})

describe('shellQuote', () => {
  it('wraps text in single quotes and escapes embedded ones', () => {
    expect(shellQuote('plain')).toBe("'plain'")
    expect(shellQuote("it's")).toBe("'it'\\''s'")
    expect(shellQuote("''")).toBe("''\\'''\\'''")
    expect(shellQuote('')).toBe("''")
  })

  it('leaves dollars, backticks and line breaks literal inside the quotes', () => {
    expect(shellQuote('$HOME `id`\nnext')).toBe("'$HOME `id`\nnext'")
  })
})

describe('claudeCommand and handoffCommand', () => {
  it('quotes the prompt as the argument of claude', () => {
    expect(claudeCommand("don't")).toBe("claude 'don'\\''t'")
  })

  it('builds the command with the repository hint', () => {
    const command = handoffCommand(input([], { owner: 'self' }))

    expect(command.startsWith("claude 'Triage sieb finding #7:")).toBe(true)
    expect(command).toContain('This repository builds')
    expect(command.endsWith("unless asked.'")).toBe(true)
  })

  it('treats only the self owner as an own image', () => {
    expect(isOwnImage({ owner: 'self' })).toBe(true)
    expect(isOwnImage({ owner: 'third-party' })).toBe(false)
    expect(isOwnImage({ owner: null })).toBe(false)
  })
})
