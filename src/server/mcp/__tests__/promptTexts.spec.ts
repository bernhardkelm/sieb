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
  ' action>" ("→ needs_patch: upgrade libexample to 1.2.1 · confidence high"),' +
  ' upstream_pending " · waiting for upstream" instead, also in tables.' +
  ' inconclusive: Why names what is missing. Why has at most 25 words. Checked and Not' +
  ' checked hold only comma-separated keywords: advisory, upstream_source, image, own_source,' +
  ' runtime; sieb data counts as advisory.'

const TABLE = 'Several triaged findings: a table | Finding | Verdict | Conf. | Proposal |'

const PLAIN =
  'Plain questions, "does CVE-X affect us" across many images included: the answer in the first' +
  ' line, at most 3 bullets with counts and names, then the sieb link.' +
  ' No table, no verdict block.'

const MIXED =
  'Find, then triage: the same, then the 4-line block of the triaged finding. No paragraphs, no' +
  ' other table.'

// Claude Code truncates MCP server instructions after this many characters
const CLAUDE_CODE_INSTRUCTIONS_LIMIT = 4096

// Room kept free below the limit, so a later rule does not push a variant over it
const INSTRUCTIONS_MARGIN = 150

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
  expect(text).not.toContain('Fix:')
  expect(text).toContain(TABLE)
  expect(text).not.toMatch(LONG_REPORT)
  expect(text).not.toMatch(/[\u2013\u2014]/u)
}

describe('serverInstructions', () => {
  it('makes a proposal the end of a triage and carries the reply format with its link', () => {
    const text = serverInstructions(true)

    expect(text).toContain('Never ask whether you should file one')
    expect(text).toContain('The detail goes into its fields, not into the chat')
    expect(text).toContain('evidence, one entry per check you ran, also when it found nothing')
    expect(text).toContain(
      'references, the pages you opened, deciding facts never rest on search snippets',
    )
    expect(text).toContain('unknowns, only what your access could not check, so check first')
    expect(text).toContain(
      'fix.action and fix.change, only steps the operator carries out, never a lookup ("check' +
        ' the release notes"): do it yourself, name the release, tag or digest.',
    )
    expect(text).toContain('no shortcut around checks you can run')
    expect(text).toContain('never guess, propose inconclusive with missing')
    expect(text).toContain('weak evidence for a verdict is that verdict with confidence low')
    expect(text).not.toMatch(/do not propose|undecided/)
    expect(text).toContain('the client has disabled the tool')
    expectReplyFormat(text, 'Proposal: <url propose_decision returns>')
    expect(text).not.toContain('Example:')
    expect(text).toContain('"3 proposals filed, 1 inconclusive"')
    expect(text).not.toContain('Copy the last line verbatim.')
    expect(text).toContain(PLAIN)
    expect(text).toContain(MIXED)
  })

  it('explains a reopened decision state to every connection', () => {
    for (const text of [serverInstructions(true, true), serverInstructions(false)]) {
      expect(text).toContain('decisionState reopened means severity rose or it became KEV listed.')
    }
  })

  it('tells a read-only connection to say that proposing needs another token', () => {
    const text = serverInstructions(false)

    expect(text).toContain('propose_decision is not in your tool list')
    expect(text).toContain('this connection only has read access')
    expect(text).toContain('reconnecting the connector with sieb:propose')
    expect(text).not.toContain('Never ask whether you should file one')
    expect(text).toContain('never guess, reply inconclusive and name what is missing')
    expect(text).toContain('Deciding facts come from pages you opened, never from search snippets')
    expect(text).not.toContain('undecided')
    expectReplyFormat(text, READ_ONLY_PROPOSAL_LINE)
    expect(text).not.toContain('<url propose_decision returns>')
    expect(text).toContain(`${BLOCK_RULES} Copy the last line verbatim.`)
    expect(text).toContain(PLAIN)
    expect(text).toContain(MIXED)
  })

  it.each([
    [true, false, false],
    [true, true, false],
    [false, false, false],
    [false, true, false],
    [true, false, true],
    [true, true, true],
    [false, true, true],
  ])(
    'fits the variant with propose %s, Claude Code %s and Auto-check %s into the instruction limit',
    (canPropose, claudeCode, checkOnly) => {
      expect(serverInstructions(canPropose, claudeCode, checkOnly).length).toBeLessThanOrEqual(
        CLAUDE_CODE_INSTRUCTIONS_LIMIT - INSTRUCTIONS_MARGIN,
      )
    },
  )

  it('gives an Auto-check the triage format only and nobody to ask', () => {
    const text = serverInstructions(true, true, true)

    expect(text).toContain('This connection belongs to one sieb Auto-check')
    expectReplyFormat(text, 'Proposal: <url propose_decision returns>')
    expect(text).not.toContain(PLAIN)
    expect(text).not.toContain('ask the user')
    expect(text).toBe(serverInstructions(true, false, true))
  })

  it('tells only Claude Code to look for the repository of an own image', () => {
    for (const canPropose of [true, false]) {
      const code = serverInstructions(canPropose, true)
      const other = serverInstructions(canPropose, false)

      expect(code).toContain(
        'private: an own image (owner self), its repository is probably on this machine: if the' +
          ' working directory is not it, ask for its path before concluding.',
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
      expect(text).toContain('(see kevNote), no contradiction')
      expect(text).toContain('may or may not be inspectable, try pulling it')
      expect(text).toContain('private: an own image (owner self)')
      expect(text).toContain('advisory-only evidence is acceptable')
      expect(text).toContain('never repeat a refused action through another tool')
      expect(text).toContain(
        'after a refused shell command still read pages with the fetch tool, it asks on its own',
      )
      expect(text).not.toContain('do not retry with another one')
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
    expect(text).toContain('without asking first, inconclusive included')
    expect(text).toContain('missing for inconclusive')
    expect(text).toContain('every check you ran has an evidence entry')
    expect(text).toContain('no unknown is something you could still check')
    expect(text).not.toMatch(/do not propose|undecided/)
    expectReplyFormat(text, 'Proposal: <url propose_decision returns>')
    expect(text).toContain(
      'Example:\n**CVE-2025-1234 · ghcr.io/example/app** → needs_patch: upgrade libexample to' +
        ' 1.2.1 · confidence high\nWhy:',
    )
    expect(text).toContain('Proposal: https://sieb.example.com/inbox/proposals/42')
    expect(text).toContain(
      '**CVE-2025-1234 · registry.example.com/acme/app** → inconclusive · confidence low',
    )
    expect(text).toContain("sieb's data and the public advisory suffice")
    expect(text).toContain('never repeat it through another tool')
    expect(text).toContain('does not rule out reading pages with the fetch tool')
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
      '8. Fix path, for needs_patch and fix_planned: find which layer ships the vulnerable' +
        ' component and whether a fix is published at that layer, then take the step at the' +
        ' closest layer the operator controls that pulls in an available fix',
    )
    expect(text).toContain(
      '   - fix.action: one line that starts with the layer and says what the operator does' +
        ' now, true to what the build references today.',
    )
    expect(text).toContain('"base image: rebuild without cache and redeploy, nginx:1.31-alpine')
    expect(text).toContain(
      '   - fix.change: the ordered steps with exact versions, tags, digests, file names and' +
        ' commands',
    )
    expect(text).toContain('fix.effort: rough effort and what it touches')
    for (const layer of ['dependency', 'base_image', 'image', 'platform']) {
      expect(text).toContain(`   - ${layer} (`)
    }
    expect(text).toContain('"base image: rebuild on alpine:3.24.4 (libxslt 1.1.43-r4)"')
    expect(text).toContain('"k3s: wait for a release bundling metrics-server v0.9.1"')
    expect(text).toContain('"dependency: bump golang.org/x/text to v0.39.0"')
    expect(text).toContain('"k3s: upgrade to v1.x.y+k3s1 or later (bundles metrics-server v0.9.1)"')
    expect(text).toContain('Never override the bundled component in fix.action.')
    expect(text).toContain('the owner only as a hint')
    expect(text).toContain('org.opencontainers.image.base.name')
    expect(triageWorkflow(false)).toContain(
      'No fix published at any layer the operator controls: the action says what to wait for and' +
        ' the verdict is fix_planned with availability upstream_pending, waitingFor and a review' +
        ' date, not needs_patch',
    )
    expect(text).not.toContain('owner not self')
  })

  it('keeps research out of What to do and facts on opened pages', () => {
    for (const canPropose of [true, false]) {
      const text = triageWorkflow(canPropose)

      expect(text).toContain(
        'No research in What to do: fix.action and fix.change hold only steps the operator' +
          ' carries out (upgrade, rebuild, deploy, confirm).',
      )
      expect(text).toContain(
        'run that check yourself with the tools you have and write its concrete result',
      )
      expect(text).toContain(
        'comes from a page you opened (advisory, release page, pull request, commit, manifest,' +
          ' registry), never from a search result snippet',
      )
      expect(text).toContain('say so in the evidence entry and lower the confidence')
    }
    expect(triageWorkflow(true)).toContain('no deciding fact rests on a search snippet')
    expect(triageWorkflow(true)).toContain('with no step that asks them to look something up')
  })

  it('decides the availability from release pages and names what is awaited', () => {
    const text = triageWorkflow(true)

    expect(text).toContain('Availability is decided, not guessed')
    expect(text).toContain('fix_planned with fix.availability available')
    expect(text).toContain(
      'fix_planned with fix.availability upstream_pending, fix.waitingFor naming exactly the' +
        ' release or image awaited',
    )
    expect(text).toContain(
      'either a newer component version or a rebuilt mirrored image of the same tag',
    )
    expect(text).toContain('github.com/k3s-io/k3s')
    expect(text).toContain('rancher/image-build-*')
    expect(text).toContain('upstream_pending always has one')
    expect(text).toContain(
      '→ fix_planned · waiting for upstream · confidence medium\nWhy: libexample 1.2.0',
    )
  })

  it('advises an interim workaround only for an urgent wait and never as the fix', () => {
    const text = triageWorkflow(true)

    expect(text).toContain(
      'only with upstream_pending and only when urgent: KEV listed, or critical or high and' +
        ' reachable on a public workload per your evidence',
    )
    expect(text).toContain('Prefer a mitigation that changes no version')
    expect(text).toContain('a HelmChartConfig image override) is allowed only here')
    expect(text).toContain('unsupported, the platform may revert it, remove it when upstream ships')
    expect(text).toContain('It is never the fix and never part of fix.action.')
    expect(text).toContain('Not urgent: no interim, the operator waits.')
  })

  it('lists verified findings of the same cause in relatedFindings instead of more proposals', () => {
    expect(triageWorkflow(true)).toContain(
      '- Same cause: when other open findings on the same image (get_image) or of the same' +
        ' package share the root cause, check each against its own CVE and version and list the' +
        ' confirmed ones in relatedFindings with a note each and relatedReason; do not file' +
        ' separate proposals for them.',
    )
    expect(triageWorkflow(false)).not.toContain('relatedFindings')
  })

  it('ends in the same reply format with the read-only line for a read-only connection', () => {
    const text = triageWorkflow(false)

    expect(text).toContain('propose_decision is not available')
    expect(text).not.toContain('File your verdict with propose_decision')
    expect(text).toContain(
      'without a supported verdict the verdict is inconclusive and Why names what is missing',
    )
    expect(text).not.toContain('undecided')
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
      expect(text).toContain(`   ${EXPOSURE_CAVEAT}\n6. Evidence: for every check record`)
    }
  })

  it('separates code that never runs from code that runs but is hard to exploit', () => {
    const text = triageWorkflow(false)

    expect(text).toContain(
      'that is not_affected with vulnerable_code_not_in_execute_path, even when an upgrade exists',
    )
    expect(text).toContain(
      "When the vulnerable code runs in the workload's process but exploitation is unlikely",
    )
  })

  it('asks for evidence per check, checked unknowns and inconclusive instead of a guess', () => {
    for (const canPropose of [true, false]) {
      const text = triageWorkflow(canPropose)

      expect(text).toContain(
        'one evidence entry per check you ran. A check that found nothing is an entry too',
      )
      expect(text).toContain(
        'References are the links of the advisory, fix and release pages you actually read.',
      )
      expect(text).toContain('10. Unknowns: only what the access you have could not check')
      expect(text).toContain('is a skipped check, not an unknown')
      expect(text).toContain('if you inspected something else instead (its public base image,')
      expect(text).toContain('- inconclusive: could not determine, it never becomes a decision.')
      expect(text).toContain(
        'Thin evidence that still points one way is that verdict with confidence low',
      )
    }
  })
})
