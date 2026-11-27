// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { EXPOSURE_CAVEAT, EXPOSURE_MEANINGS } from '#core/exposureMeaning.ts'
import { READ_ONLY_PROPOSAL_LINE } from '#core/handoffPrompt.ts'
import { serverInstructions } from '#server/mcp/serverInstructions.ts'
import { triageWorkflow } from '#server/mcp/triagePromptText.ts'

const LONG_REPORT = /report back|in this structure|report your findings/i

const SKELETON = [
  'One finding: at most 4 lines, nothing else unless asked:',
  '**<CVE> · <image>** → <verdict> (<OpenVEX justification, not_affected only>) · confidence <low|medium|high>',
  'Why: <one sentence, the decisive argument>',
  'Checked: <keywords> · Not checked: <keywords>',
]

const BLOCK_RULES =
  'The first line contains "confidence"; needs_patch and fix_planned add ": <exact patch' +
  ' action>", also in tables. Why has at most 25 words. Checked and Not' +
  ' checked hold only comma-separated keywords: advisory, upstream_source, image, own_source,' +
  ' runtime; sieb data counts as advisory.'

const TABLE = 'Several triaged findings: a table | Finding | Verdict | Conf. | Proposal |'

const PLAIN =
  'Plain questions, "does CVE-X affect us" across many images included: the answer in the first' +
  ' line, at most 3 bullets with counts and names, then the sieb link.' +
  ' No table, no verdict block.'

const MIXED =
  'Find, then triage: the first line answers the question, at most 3 bullets, then the 4-line' +
  ' block of the triaged finding. No paragraphs, no other table.'

const EMPTY_SEARCH =
  'A filtered search returning 0: the first line says so before you widen it and names the' +
  ' widened filter'

// Claude Code truncates MCP server instructions after this many characters
const CLAUDE_CODE_INSTRUCTIONS_LIMIT = 4096

/**
 * Asserts the reply format skeleton of one and several findings with the given proposal line.
 * @param {string} text - Instructions or prompt text
 * @param {string} proposalLine - Expected last line of a single-finding reply
 * @returns {void}
 */
const expectReplyFormat = (text: string, proposalLine: string): void => {
  expect(text).toContain(
    `Reply in the sieb format.\n${SKELETON.join('\n')}\n${proposalLine}\n${BLOCK_RULES}`,
  )
  expect(text).toContain(
    '**CVE-2025-1234 · ghcr.io/example/app** → needs_patch: upgrade libexample to 1.2.1 · confidence high',
  )
  expect(text).not.toContain('Fix:')
  expect(text).toContain(TABLE)
  expect(text).not.toMatch(LONG_REPORT)
  expect(text).not.toMatch(/[\u2013\u2014]/u)
}

describe('serverInstructions', () => {
  it('makes a proposal the end of a triage and carries the reply format with its link', () => {
    const text = serverInstructions(true)

    expect(text).toContain('Never ask whether you should file one')
    expect(text).toContain('Put the detail into the proposal fields (presence, reachability,')
    expect(text).toContain('fix, review, unknowns, references), not into the chat')
    expect(text).toContain('with an upgrade as the fix: propose needs_patch or fix_planned.')
    expect(text).toContain('the client has disabled the tool')
    expectReplyFormat(text, 'Proposal: <url propose_decision returns>')
    expect(text).toContain('Proposal: https://sieb.example.com/inbox/proposals/42')
    expect(text).toContain('1 skipped (no verdict)')
    expect(text).not.toContain('Copy the last line verbatim.')
    expect(text).toContain(PLAIN)
    expect(text).toContain(MIXED)
    expect(text).toContain(EMPTY_SEARCH)
  })

  it('tells a read-only connection to say that proposing needs another token', () => {
    const text = serverInstructions(false)

    expect(text).toContain('propose_decision is not in your tool list')
    expect(text).toContain('this connection only has read access')
    expect(text).toContain('reconnecting the connector with sieb:propose')
    expect(text).not.toContain('Never ask whether you should file one')
    expectReplyFormat(text, READ_ONLY_PROPOSAL_LINE)
    expect(text).not.toContain('<url propose_decision returns>')
    expect(text).toContain(`${BLOCK_RULES} Copy the last line verbatim.`)
    expect(text).toContain(PLAIN)
    expect(text).toContain(MIXED)
  })

  it.each([
    [true, false],
    [true, true],
    [false, false],
    [false, true],
  ])(
    'fits the variant with propose %s and Claude Code %s into the instruction limit',
    (canPropose, claudeCode) => {
      expect(serverInstructions(canPropose, claudeCode).length).toBeLessThanOrEqual(
        CLAUDE_CODE_INSTRUCTIONS_LIMIT,
      )
    },
  )

  it('tells only Claude Code to look for the repository of an own image', () => {
    for (const canPropose of [true, false]) {
      const code = serverInstructions(canPropose, true)
      const other = serverInstructions(canPropose, false)

      expect(code).toContain(
        'private: an own image (owner self), its repository is probably on this machine: if the' +
          ' working directory is not it (git remote, Dockerfile or build config naming the' +
          ' image), ask the user for its path before concluding.',
      )
      expect(code).not.toContain('unless you run in its repository')
      expect(other).toContain(
        "private: an own image (owner self), advisory and sieb's data only unless you run in" +
          ' its repository.',
      )
      expect(other).not.toContain('working directory')
    }
  })

  it('explains the KEV source and the unknown source access in both variants', () => {
    for (const text of [
      serverInstructions(true),
      serverInstructions(false),
      serverInstructions(true, true),
    ]) {
      expect(text).toContain('kevCatalog is null by design')
      expect(text).toContain('that is not a contradiction')
      expect(text).toContain('may or may not be inspectable, try pulling it')
      expect(text).toContain('private: an own image (owner self)')
      expect(text).toContain('advisory-only evidence is acceptable')
      expect(text).toContain('When a tool outside sieb is refused, do not retry with another one')
      expect(text).toContain(
        '"public" in a question means exposure public unless the user says registry or source',
      )
    }
  })
})

describe('triageWorkflow', () => {
  it('ends in propose_decision and the reply format with the proposal link', () => {
    const text = triageWorkflow(true)

    expect(text).toContain('list_my_proposals')
    expect(text).toContain('File your verdict with propose_decision without asking first')
    expectReplyFormat(text, 'Proposal: <url propose_decision returns>')
    expect(text).toContain("sieb's data and the public advisory suffice")
    expect(text).toContain(
      'its repository is often on this machine, so if you can read files, check whether the' +
        ' working directory is it',
    )
    expect(text).toContain('say so and ask for its local path')
    expect(text).not.toContain(PLAIN)
    expect(text).not.toContain(MIXED)
  })

  it('asks for the patch step at the closest layer that pulls in a published fix', () => {
    const text = triageWorkflow(true)

    expect(text).toContain(
      '8. Fix path: for needs_patch and fix_planned the patch action: find which layer ships the' +
        ' vulnerable component and whether a fix is published at that layer, then name the step' +
        ' at the closest layer the operator controls that pulls in an available fix',
    )
    for (const layer of ['dependency', 'base_image', 'image', 'platform']) {
      expect(text).toContain(`   - ${layer} (`)
    }
    expect(text).toContain('"base image: rebuild on alpine:3.24.4 (libxslt 1.1.43-r4)"')
    expect(text).toContain('"k3s: wait for a release bundling metrics-server v0.9.1"')
    expect(text).toContain('"dependency: bump golang.org/x/text to v0.39.0"')
    expect(text).toContain('Never suggest overriding the bundled component.')
    expect(text).toContain('the owner only as a hint')
    expect(text).toContain('org.opencontainers.image.base.name')
    expect(text).toContain('Manual overrides only as an explicit exception for high risk')
    expect(triageWorkflow(false)).toContain(
      'No fix published at any layer the operator controls: the action says what to wait for and' +
        ' the verdict is fix_planned with a review date, not needs_patch',
    )
    expect(text).not.toContain('owner not self')
  })

  it('ends in the same reply format with the read-only line for a read-only connection', () => {
    const text = triageWorkflow(false)

    expect(text).toContain('propose_decision is not available')
    expect(text).not.toContain('File your verdict with propose_decision')
    expectReplyFormat(text, READ_ONLY_PROPOSAL_LINE)
  })

  it('defines every exposure tier and the network entry caveat in the exposure step', () => {
    for (const canPropose of [true, false]) {
      const text = triageWorkflow(canPropose)

      expect(text).toContain('5. Exposure: how the workload is exposed')
      expect(text).toContain('exposureNote in tool results')
      for (const tier of ['public', 'gated', 'internal', 'unknown'] as const) {
        expect(text).toContain(`   - ${tier}: ${EXPOSURE_MEANINGS[tier]}`)
      }
      expect(text).toContain(`   ${EXPOSURE_CAVEAT}\n6. Evidence`)
    }
  })

  it('prefers needs_patch over not_affected for an unreachable but present vulnerability', () => {
    expect(triageWorkflow(false)).toContain(
      'Affected but practically unreachable, with an upgrade as the fix: that is needs_patch',
    )
  })
})
