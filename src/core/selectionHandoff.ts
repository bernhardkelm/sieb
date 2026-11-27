import type { FindingView } from '#core/findingView.ts'
import { fitsLink, type HandoffClient } from '#core/handoffLinks.ts'
import {
  buildHandoffPrompts,
  handoffCommand,
  isOwnImage,
  type HandoffPrompts,
} from '#core/handoffPrompt.ts'
import { multiLinkPrompt, type MultiLinkPrompt } from '#core/multiHandoffLink.ts'
import {
  buildMultiHandoffPrompts,
  listedFindings,
  multiHandoffCommand,
} from '#core/multiHandoffPrompt.ts'

/** Fields of a selected finding the hand-off reads */
export type SelectionHandoffFinding = Pick<
  FindingView,
  'id' | 'vulnId' | 'imageRef' | 'owner' | 'packages'
>

export interface SelectionHandoffTexts {
  /** Full prompts per client kind, the chat one is copied */
  prompts: HandoffPrompts
  /** Prompt a deep link carries per client kind, with the most findings a link fits */
  links: Readonly<Record<HandoffClient, MultiLinkPrompt>>
  /** claude command, null unless every image is an own image of one repository */
  command: string | null
  /** Findings the prompts list, at most the cap */
  listed: number
  /** Selected findings */
  total: number
}

/**
 * Wraps a single-finding prompt as a link prompt, null when it is too long for a link.
 * @param {string} prompt - Prompt
 * @returns {MultiLinkPrompt} - Link prompt
 */
const singleLink = (prompt: string): MultiLinkPrompt =>
  fitsLink(prompt) ? { prompt, max: 1 } : { prompt: null, max: 0 }

/**
 * Builds the hand-off texts of one selected finding with the single-finding prompt, the
 * packages coming from the list row.
 * @param {SelectionHandoffFinding} finding - Selected finding
 * @returns {SelectionHandoffTexts} - Texts
 */
const singleTexts = (finding: SelectionHandoffFinding): SelectionHandoffTexts => {
  const input = { finding, instances: [] }
  const prompts = buildHandoffPrompts(input)

  return {
    prompts,
    links: { chat: singleLink(prompts.chat), code: singleLink(prompts.code) },
    command: isOwnImage(finding) ? handoffCommand(input) : null,
    listed: 1,
    total: 1,
  }
}

/**
 * Builds the hand-off texts of the checked rows of a list: the single-finding prompt for one,
 * the grouped multi-finding prompt for more, capped for copying and fitted for deep links.
 * @param {readonly SelectionHandoffFinding[]} findings - Selected findings in list order
 * @returns {SelectionHandoffTexts | null} - Texts, null without a selection
 */
export const selectionHandoffTexts = (
  findings: readonly SelectionHandoffFinding[],
): SelectionHandoffTexts | null => {
  const [first] = findings

  if (first === undefined) {
    return null
  }

  if (findings.length === 1) {
    return singleTexts(first)
  }

  return {
    prompts: buildMultiHandoffPrompts(findings),
    links: { chat: multiLinkPrompt(findings, 'chat'), code: multiLinkPrompt(findings, 'code') },
    command: multiHandoffCommand(findings),
    listed: listedFindings(findings).length,
    total: findings.length,
  }
}
