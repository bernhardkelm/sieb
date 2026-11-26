import { describe, expect, it } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import {
  claudeCliLink,
  claudeDesktopChatLink,
  claudeDesktopCodeLink,
  HANDOFF_CLIENTS,
  HANDOFF_TARGETS,
  handoffLink,
  PROMPT_LINK_LIMIT,
  vscodeLink,
} from '#core/handoffLinks.ts'
import { buildHandoffPrompt, buildHandoffPrompts } from '#core/handoffPrompt.ts'

const PROMPT = 'Triage #7: CVE-2024-1 in a/b:1 & more?\nsecond line'
const ENCODED = 'Triage%20%237%3A%20CVE-2024-1%20in%20a%2Fb%3A1%20%26%20more%3F%0Asecond%20line'

describe('hand-off links', () => {
  it('encodes the prompt as the only query value of each documented link', () => {
    expect(claudeDesktopCodeLink(PROMPT)).toBe(`claude://code/new?q=${ENCODED}`)
    expect(claudeDesktopChatLink(PROMPT)).toBe(`claude://claude.ai/new?q=${ENCODED}`)
    expect(claudeCliLink(PROMPT)).toBe(`claude-cli://open?q=${ENCODED}`)
    expect(vscodeLink(PROMPT)).toBe(`vscode://anthropic.claude-code/open?prompt=${ENCODED}`)
  })

  it('maps every target to its builder', () => {
    expect(HANDOFF_TARGETS.map((target) => handoffLink(target, 'x'))).toEqual([
      'claude://code/new?q=x',
      'claude://claude.ai/new?q=x',
      'claude-cli://open?q=x',
      'vscode://anthropic.claude-code/open?prompt=x',
    ])
  })

  it('round-trips the real prompt without extra parameters', () => {
    const prompt = buildHandoffPrompt({
      finding: buildFindingView({ id: 7, vulnId: 'CVE-2024-3094', imageRef: 'nginx:1.25' }),
      instances: [],
    })

    for (const target of HANDOFF_TARGETS) {
      const link = new URL(handoffLink(target, prompt)!)

      expect([...link.searchParams.keys()]).toEqual([target === 'vscode' ? 'prompt' : 'q'])
      expect([...link.searchParams.values()]).toEqual([prompt])
      expect(prompt).not.toMatch(/sieb_[a-z0-9]|secret|bearer/i)
    }
  })

  it('opens Claude Code for the code targets and the chat for desktop-chat', () => {
    expect(HANDOFF_CLIENTS).toEqual({
      'desktop-code': 'code',
      'desktop-chat': 'chat',
      cli: 'code',
      vscode: 'code',
    })
  })

  it('refuses prompts whose encoded form reaches the link limit, for every target', () => {
    const fits = 'a'.repeat(PROMPT_LINK_LIMIT - 1)

    expect(PROMPT_LINK_LIMIT).toBeLessThanOrEqual(800)

    for (const target of HANDOFF_TARGETS) {
      expect(handoffLink(target, fits)).not.toBeNull()
      expect(handoffLink(target, `${fits}a`)).toBeNull()
    }
  })

  it('counts the encoded length, so spaces weigh three characters', () => {
    const spaces = ' '.repeat(Math.ceil(PROMPT_LINK_LIMIT / 3))

    expect(spaces.length).toBeLessThan(PROMPT_LINK_LIMIT)
    expect(claudeCliLink(spaces)).toBeNull()
  })

  it('fits a realistic worst case into the link of every target', () => {
    const prompts = buildHandoffPrompts({
      finding: buildFindingView({
        id: 123_456,
        vulnId: 'GHSA-abcd-efgh-ijkl',
        imageRef: 'registry.gitlab.com/example-group/platform-team/payments-api/worker-service',
        owner: 'self',
      }),
      instances: [
        'google.golang.org/grpc',
        'github.com/opencontainers/runc',
        'golang.org/x/net',
        'golang.org/x/crypto',
        'stdlib',
      ].map((name) => ({ package: name, resolvedAt: null })),
    })

    for (const target of HANDOFF_TARGETS) {
      const prompt = prompts[HANDOFF_CLIENTS[target]]

      expect(handoffLink(target, prompt)).not.toBeNull()
      expect(prompt).toContain('#123456: GHSA-abcd-efgh-ijkl in registry.gitlab.com/')
      expect(prompt).toContain('Reply in the sieb format from the server instructions.')
    }

    expect(prompts.code).toContain('working directory')
  })
})
