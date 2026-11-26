import { READ_ONLY_PROPOSAL_LINE } from '#core/handoffPrompt.ts'

const EXAMPLE_HEAD = `**CVE-2025-1234 · ghcr.io/example/app** → needs_patch · confidence high
Why: libexample 1.2.0 is installed and its vulnerable parser handles every request body.
Checked: advisory, image · Not checked: runtime
Fix: upgrade libexample to 1.2.1 in the base image`

const BLOCK_RULES =
  'The first line contains the word "confidence". Why has at most 25 words. Checked and Not checked hold only comma-separated keywords: advisory, upstream_source, image, own_source, runtime; sieb data counts as advisory.'

/**
 * Returns the sieb reply format for one finding, with the proposal line of the connection.
 * @param {boolean} canPropose - Whether the caller can call propose_decision
 * @returns {string} - Rules, skeleton and example
 */
const singleFinding = (canPropose: boolean): string => {
  const proposal = canPropose ? 'Proposal: <url propose_decision returns>' : READ_ONLY_PROPOSAL_LINE
  const example = canPropose ? 'Proposal: https://sieb.example.com/inbox/proposals/42' : proposal
  const verbatim = canPropose ? '' : ' Copy the last line verbatim.'

  return `One finding: at most 5 lines, nothing else unless asked:
**<CVE> · <image>** → <verdict> (<OpenVEX justification, not_affected only>) · confidence <low|medium|high>
Why: <one sentence, the decisive argument>
Checked: <keywords> · Not checked: <keywords>
Fix: <one line, or "none needed">
${proposal}
${BLOCK_RULES}${verbatim}
Example:
${EXAMPLE_HEAD}
${example}`
}

/**
 * Returns the sieb reply format for several findings.
 * @param {boolean} canPropose - Whether the caller can call propose_decision
 * @returns {string} - Rules with an example summary line
 */
const severalFindings = (canPropose: boolean): string =>
  canPropose
    ? 'Several triaged findings: a table | Finding | Verdict | Conf. | Proposal |, then one summary line such as "3 proposals filed, 1 skipped (no verdict)".'
    : `Several triaged findings: a table | Finding | Verdict | Conf. | Proposal | with "none" as proposal, then the line "${READ_ONLY_PROPOSAL_LINE}"`

const QUESTIONS = `Plain questions, "does CVE-X affect us" across many images included: the answer in the first line, at most 3 bullets with counts and names, then the sieb link. No table, no verdict block.
Find, then triage: the first line answers the question, at most 3 bullets, then the 5-line block of the triaged finding. No paragraphs, no other table.
A filtered search returning 0: the first line says so before you widen it and names the widened filter ("None with exposure public; widened to all exposures:").`

/**
 * Returns the sieb reply format of a triage, for one and for several findings.
 * @param {boolean} canPropose - Whether the caller can call propose_decision
 * @returns {string} - Reply format
 */
export const triageReplyFormat = (canPropose: boolean): string =>
  `Reply in the sieb format.\n${singleFinding(canPropose)}\n${severalFindings(canPropose)}`

/**
 * Returns the full sieb reply format the server instructions carry, plain questions included.
 * @param {boolean} canPropose - Whether the caller can call propose_decision
 * @returns {string} - Reply format
 */
export const replyFormat = (canPropose: boolean): string =>
  `${triageReplyFormat(canPropose)}\n${QUESTIONS}`
