import { READ_ONLY_PROPOSAL_LINE } from '#core/handoffPrompt.ts'

const EXAMPLE_HEAD =
  '**CVE-2025-1234 · ghcr.io/example/app** → needs_patch: upgrade libexample to 1.2.1 · confidence high'

const EXAMPLE_BODY = `Why: libexample 1.2.0 is installed and its parser handles every request body.
Checked: advisory, image · Not checked: runtime`

const EXAMPLE_INCONCLUSIVE = `Inconclusive example:
**CVE-2025-1234 · registry.example.com/acme/app** → inconclusive · confidence low
Why: the registry denied the pull, so whether libexample is installed could not be checked.
Checked: advisory · Not checked: image, own_source, runtime`

const BLOCK_RULES =
  'The first line contains "confidence"; needs_patch and fix_planned add ": <exact patch action>" ("→ needs_patch: upgrade libexample to 1.2.1 · confidence high"), also in tables. inconclusive: Why names what is missing. Why has at most 25 words. Checked and Not checked hold only comma-separated keywords: advisory, upstream_source, image, own_source, runtime; sieb data counts as advisory.'

/**
 * Returns the example blocks of a single-finding reply, left out of the server instructions,
 * which have a length limit and carry the first line inside the rules.
 * @param {string} proposalLine - Last line of each example
 * @returns {string} - Example of a verdict and of an inconclusive reply
 */
const examples = (proposalLine: string): string =>
  `\nExample:\n${EXAMPLE_HEAD}\n${EXAMPLE_BODY}\n${proposalLine}\n${EXAMPLE_INCONCLUSIVE}\n${proposalLine}`

/**
 * Returns the sieb reply format for one finding, with the proposal line of the connection.
 * @param {boolean} canPropose - Whether the caller can call propose_decision
 * @param {boolean} full - Whether to append the example blocks
 * @returns {string} - Skeleton, rules and examples
 */
const singleFinding = (canPropose: boolean, full: boolean): string => {
  const proposal = canPropose ? 'Proposal: <url propose_decision returns>' : READ_ONLY_PROPOSAL_LINE
  const exampleLine = canPropose
    ? 'Proposal: https://sieb.example.com/inbox/proposals/42'
    : proposal
  const verbatim = canPropose ? '' : ' Copy the last line verbatim.'

  return `One finding: at most 4 lines, nothing else unless asked:
**<CVE> · <image>** → <verdict> (<OpenVEX justification, not_affected only>) · confidence <low|medium|high>
Why: <one sentence, the decisive argument>
Checked: <keywords> · Not checked: <keywords>
${proposal}
${BLOCK_RULES}${verbatim}${full ? examples(exampleLine) : ''}`
}

/**
 * Returns the sieb reply format for several findings.
 * @param {boolean} canPropose - Whether the caller can call propose_decision
 * @returns {string} - Rules with an example summary line
 */
const severalFindings = (canPropose: boolean): string =>
  canPropose
    ? 'Several triaged findings: a table | Finding | Verdict | Conf. | Proposal |, then one summary line such as "3 proposals filed, 1 of them inconclusive".'
    : `Several triaged findings: a table | Finding | Verdict | Conf. | Proposal | with "none" as proposal, then the line "${READ_ONLY_PROPOSAL_LINE}"`

const QUESTIONS = `Plain questions, "does CVE-X affect us" across many images included: the answer in the first line, at most 3 bullets with counts and names, then the sieb link. No table, no verdict block.
Find, then triage: the same, then the 4-line block of the triaged finding. No paragraphs, no other table.
A filtered search returning 0: say so in the first line before you widen it and name the widened filter ("None with exposure public; widened to all exposures:").`

/**
 * Joins the reply format of one and of several findings.
 * @param {boolean} canPropose - Whether the caller can call propose_decision
 * @param {boolean} full - Whether to append the example blocks
 * @returns {string} - Reply format
 */
const findingsFormat = (canPropose: boolean, full: boolean): string =>
  `Reply in the sieb format.\n${singleFinding(canPropose, full)}\n${severalFindings(canPropose)}`

/**
 * Returns the sieb reply format of a triage with full examples, for the triage workflow.
 * @param {boolean} canPropose - Whether the caller can call propose_decision
 * @returns {string} - Reply format
 */
export const triageReplyFormat = (canPropose: boolean): string => findingsFormat(canPropose, true)

/**
 * Returns the short sieb reply format the server instructions carry, with plain questions
 * unless the connection only triages one finding.
 * @param {boolean} canPropose - Whether the caller can call propose_decision
 * @param {boolean} questions - Whether to add the format of plain questions
 * @returns {string} - Reply format
 */
export const replyFormat = (canPropose: boolean, questions = true): string =>
  questions
    ? `${findingsFormat(canPropose, false)}\n${QUESTIONS}`
    : findingsFormat(canPropose, false)
