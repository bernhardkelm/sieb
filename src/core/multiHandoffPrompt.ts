import { claudeCommand, oneLine, type HandoffPrompts } from '#core/handoffPrompt.ts'
import type { HandoffContext } from '#core/handoffRepositoryLine.ts'
import {
  multiRepositoryLine,
  sharedOwnRepository,
  type MultiHandoffFinding,
} from '#core/multiHandoffRepositoryLine.ts'

/** Most findings a copied prompt lists, the rest of a larger selection is left out */
export const MULTI_HANDOFF_CAP = 50

/** Findings of one CVE, ids and images in selection order */
interface VulnGroup {
  vulnId: string
  ids: number[]
  imageRefs: string[]
}

/**
 * Returns the findings a prompt lists: the first MULTI_HANDOFF_CAP in selection order.
 * @param {readonly MultiHandoffFinding[]} findings - Selected findings
 * @returns {readonly MultiHandoffFinding[]} - Listed findings
 */
export const listedFindings = (
  findings: readonly MultiHandoffFinding[],
): readonly MultiHandoffFinding[] => findings.slice(0, MULTI_HANDOFF_CAP)

/**
 * Groups findings by CVE in first-seen order, so one line names every image of a CVE.
 * @param {readonly MultiHandoffFinding[]} findings - Findings
 * @returns {VulnGroup[]} - Groups with distinct single-line image refs
 */
const groupByVuln = (findings: readonly MultiHandoffFinding[]): VulnGroup[] => {
  const groups = new Map<string, VulnGroup>()

  for (const finding of findings) {
    const vulnId = oneLine(finding.vulnId)
    const group = groups.get(vulnId) ?? { vulnId, ids: [], imageRefs: [] }
    const imageRef = oneLine(finding.imageRef)

    group.ids.push(finding.id)

    if (!group.imageRefs.includes(imageRef)) {
      group.imageRefs.push(imageRef)
    }

    groups.set(vulnId, group)
  }

  return [...groups.values()]
}

/**
 * Formats the line of a CVE group, with its images or, in the compact form, without them.
 * @param {VulnGroup} group - Findings of one CVE
 * @param {boolean} withImages - Whether to name the images
 * @returns {string} - Line such as "#3 #4 CVE-2025-1 in a:1, b:2"
 */
const groupLine = (group: VulnGroup, withImages: boolean): string => {
  const ids = group.ids.map((id) => `#${id}`).join(' ')

  return withImages
    ? `${ids} ${group.vulnId} in ${group.imageRefs.join(', ')}`
    : `${ids} ${group.vulnId}`
}

/**
 * Composes the multi-finding prompt: a header, one line per CVE, then get_finding for each,
 * propose_decision without asking and the sieb reply format for several findings, which the
 * server instructions define. A CVE on several images adds that one proposal with vulnId and
 * imageRefs may cover them.
 * @param {readonly MultiHandoffFinding[]} findings - Findings to list, already capped
 * @param {HandoffContext} context - Where the prompt runs
 * @param {boolean} withImages - Whether the lines name the images, the compact form leaves them to get_finding
 * @returns {string} - Prompt
 */
export const composeMultiPrompt = (
  findings: readonly MultiHandoffFinding[],
  context: HandoffContext,
  withImages = true,
): string => {
  const groups = groupByVuln(findings)
  const grouped = groups.some((group) => group.ids.length > 1)
  const cover = grouped
    ? ', one proposal with vulnId and imageRefs may cover several images of a CVE'
    : ''

  return [
    'Triage these sieb findings, one proposal each:',
    ...groups.map((group) => groupLine(group, withImages)),
    `Run get_finding for each, check presence, reachability and exposure.` +
      `${multiRepositoryLine(findings, context)} File each verdict with propose_decision` +
      ` without asking${cover}. Reply in the sieb format for several findings from the server instructions. Do not change` +
      ' code unless asked.',
  ].join('\n')
}

/**
 * Builds the prompt of each client kind for two or more findings, listing at most
 * MULTI_HANDOFF_CAP of them; the chat one also serves the copied prompt.
 * @param {readonly MultiHandoffFinding[]} findings - Selected findings in selection order
 * @returns {HandoffPrompts} - Chat and Claude Code prompts
 */
export const buildMultiHandoffPrompts = (
  findings: readonly MultiHandoffFinding[],
): HandoffPrompts => {
  const listed = listedFindings(findings)

  return {
    chat: composeMultiPrompt(listed, 'chat'),
    code: composeMultiPrompt(listed, 'code'),
  }
}

/**
 * Builds the claude command for findings of own images built from one repository, to run
 * inside that repository. Every selected finding has to be one, the prompt lists at most
 * MULTI_HANDOFF_CAP of them.
 * @param {readonly MultiHandoffFinding[]} findings - Selected findings
 * @returns {string | null} - Command, null once any selected image is foreign or of another repository
 */
export const multiHandoffCommand = (findings: readonly MultiHandoffFinding[]): string | null =>
  sharedOwnRepository(findings) === null
    ? null
    : claudeCommand(composeMultiPrompt(listedFindings(findings), 'repository'))
