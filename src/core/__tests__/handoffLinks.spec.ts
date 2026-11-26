import { describe, expect, it } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import {
  CLI_PROMPT_LIMIT,
  claudeCliLink,
  claudeDesktopChatLink,
  claudeDesktopCodeLink,
  DESKTOP_PROMPT_LIMIT,
  HANDOFF_TARGETS,
  handoffLink,
  vscodeLink,
} from '#core/handoffLinks.ts'
import { buildHandoffPrompt } from '#core/handoffPrompt.ts'

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
      url: 'https://sieb.example.com/triage?finding=7',
    })

    for (const target of HANDOFF_TARGETS) {
      const link = new URL(handoffLink(target, prompt)!)

      expect([...link.searchParams.keys()]).toEqual([target === 'vscode' ? 'prompt' : 'q'])
      expect([...link.searchParams.values()]).toEqual([prompt])
      expect(prompt).not.toMatch(/token|secret|bearer/i)
    }
  })

  it('refuses prompts whose encoded form reaches the desktop limit', () => {
    expect(claudeDesktopCodeLink('a'.repeat(DESKTOP_PROMPT_LIMIT - 1))).not.toBeNull()
    expect(claudeDesktopCodeLink('a'.repeat(DESKTOP_PROMPT_LIMIT))).toBeNull()
    expect(claudeDesktopChatLink('a'.repeat(DESKTOP_PROMPT_LIMIT))).toBeNull()
  })

  it('refuses prompts whose encoded form reaches the CLI limit, also for VS Code', () => {
    const fits = 'a'.repeat(CLI_PROMPT_LIMIT - 1)

    expect(claudeCliLink(fits)).not.toBeNull()
    expect(vscodeLink(fits)).not.toBeNull()
    expect(claudeCliLink(`${fits}a`)).toBeNull()
    expect(vscodeLink(`${fits}a`)).toBeNull()
    expect(claudeDesktopCodeLink(`${fits}a`)).not.toBeNull()
  })

  it('counts the encoded length, so spaces weigh three characters', () => {
    const spaces = ' '.repeat(Math.ceil(CLI_PROMPT_LIMIT / 3))

    expect(spaces.length).toBeLessThan(CLI_PROMPT_LIMIT)
    expect(claudeCliLink(spaces)).toBeNull()
  })
})
