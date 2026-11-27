import type { FindingView } from '#core/findingView.ts'
import { fitsLink, type HandoffClient } from '#core/handoffLinks.ts'
import { repositoryLine, type HandoffContext } from '#core/handoffRepositoryLine.ts'
import type { FindingInstance } from '#core/instance.ts'
import { SELF_OWNER } from '#core/owner.ts'

export interface HandoffInput {
  finding: Pick<FindingView, 'id' | 'vulnId' | 'imageRef' | 'owner' | 'packages'>
  instances: readonly Pick<FindingInstance, 'package' | 'resolvedAt'>[]
}

const MAX_PACKAGES = 3

/** Last line of a sieb format reply when the connection cannot propose */
export const READ_ONLY_PROPOSAL_LINE =
  'No proposal filed: this connection is read-only (token or connector needs sieb:propose).'

/** Prompt per client kind, the chat one also serves the copied prompt */
export type HandoffPrompts = Readonly<Record<HandoffClient, string>>

/**
 * Collapses line breaks, control characters and runs of whitespace into single spaces, so
 * scanner-provided values cannot break the one-line prompt.
 * @param {string} text - Raw value
 * @returns {string} - Single-line value
 */
export const oneLine = (text: string): string => text.replaceAll(/[\p{Cc}\s]+/gu, ' ').trim()

/**
 * Returns the affected package names, from the open instances unless every instance is
 * resolved, else from the finding.
 * @param {HandoffInput} input - Finding and instances
 * @returns {string[]} - Distinct single-line names in first-seen order
 */
const packageNames = ({ finding, instances }: HandoffInput): string[] => {
  const open = instances.filter((instance) => instance.resolvedAt === null)
  const fromInstances = (open.length > 0 ? open : instances).map((instance) => instance.package)
  const names = fromInstances.some((name) => name !== null) ? fromInstances : finding.packages

  return [...new Set(names.filter((name) => name !== null).map(oneLine))].filter(
    (name) => name !== '',
  )
}

/**
 * Describes the affected packages by name, at most MAX_PACKAGES of them; get_finding returns
 * their versions.
 * @param {HandoffInput} input - Finding and instances
 * @returns {string} - Text such as " (openssl, libssl3, +2 more)", empty without packages
 */
const packageText = (input: HandoffInput): string => {
  const names = packageNames(input)

  if (names.length === 0) {
    return ''
  }

  const more = names.length > MAX_PACKAGES ? `, +${names.length - MAX_PACKAGES} more` : ''

  return ` (${names.slice(0, MAX_PACKAGES).join(', ')}${more})`
}

/**
 * Returns whether a finding belongs to an image built from your own repositories, where the
 * claude command makes sense.
 * @param {Pick<FindingView, 'owner'>} finding - Finding
 * @returns {boolean} - True for the self owner
 */
export const isOwnImage = (finding: Pick<FindingView, 'owner'>): boolean =>
  finding.owner === SELF_OWNER

/**
 * Joins the prompt around an optional package part.
 * @param {HandoffInput['finding']} finding - Finding
 * @param {string} packages - Package part, empty to leave it out
 * @param {string} repository - Repository sentence with a leading space, may be empty
 * @returns {string} - Prompt
 */
const composePrompt = (
  finding: HandoffInput['finding'],
  packages: string,
  repository: string,
): string =>
  `Triage sieb finding #${finding.id}: ${oneLine(finding.vulnId)} in ${oneLine(finding.imageRef)}` +
  `${packages}. Run get_finding with findingId ${finding.id}, check presence, reachability and` +
  ` exposure.${repository} File your verdict with propose_decision without asking. Reply in the` +
  ' sieb format from the server instructions. Do not change code unless asked.'

/**
 * Builds the short one-line prompt that hands a finding over to Claude through the sieb MCP
 * tools, the essentials first: read the finding, file the verdict with propose_decision, reply
 * in the sieb format the server instructions define. In Claude Code an own image also points
 * at its repository. The package names go when they would push the prompt past the link
 * limit, get_finding returns them anyway.
 * @param {HandoffInput} input - Finding and its instances
 * @param {HandoffContext} context - Where the prompt runs: chat, code or the image's repository
 * @returns {string} - Prompt
 */
export const buildHandoffPrompt = (
  input: HandoffInput,
  context: HandoffContext = 'chat',
): string => {
  const { finding } = input
  const repository = repositoryLine(oneLine(finding.imageRef), context, isOwnImage(finding))
  const prompt = composePrompt(finding, packageText(input), repository)

  return fitsLink(prompt) ? prompt : composePrompt(finding, '', repository)
}

/**
 * Builds the prompt of each client kind.
 * @param {HandoffInput} input - Finding and its instances
 * @returns {HandoffPrompts} - Chat and Claude Code prompts
 */
export const buildHandoffPrompts = (input: HandoffInput): HandoffPrompts => ({
  chat: buildHandoffPrompt(input, 'chat'),
  code: buildHandoffPrompt(input, 'code'),
})

/**
 * Quotes a text as one POSIX shell word: single quotes, each embedded quote as '\''.
 * @param {string} text - Raw text
 * @returns {string} - Quoted word
 */
export const shellQuote = (text: string): string => `'${text.replaceAll("'", "'\\''")}'`

/**
 * Builds the shell command that starts Claude Code with a prompt.
 * @param {string} prompt - Prompt
 * @returns {string} - Command such as claude 'Triage ...'
 */
export const claudeCommand = (prompt: string): string => `claude ${shellQuote(prompt)}`

/**
 * Builds the claude command of a finding, with the hint that the repository builds its image.
 * @param {HandoffInput} input - Finding and its instances
 * @returns {string} - Command
 */
export const handoffCommand = (input: HandoffInput): string =>
  claudeCommand(buildHandoffPrompt(input, 'repository'))
