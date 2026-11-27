import { HANDOFF_CLIENTS } from '#core/handoffLinks.ts'
import type { MultiLinkPrompt } from '#core/multiHandoffLink.ts'
import type { SelectionHandoffTexts } from '#core/selectionHandoff.ts'
import {
  NO_SELECTION_REASON,
  NOT_ONE_REPOSITORY_REASON,
  NOT_OWN_REASON,
} from '@/format/handoffReasons'
import type { HandoffPreference } from '@/format/handoffTargets'

/**
 * Returns why a deep link cannot carry the selection, naming how many findings would fit.
 * @param {MultiLinkPrompt} link - Link prompt of the target's client kind
 * @returns {string | null} - Reason, null while the prompt fits
 */
export const linkReason = (link: MultiLinkPrompt): string | null => {
  if (link.prompt !== null) {
    return null
  }

  return link.max < 2
    ? 'Too long for a link, copy the prompt instead'
    : `Too many findings for a link (${link.max} max), copy the prompt instead`
}

/**
 * Returns why the selection has no claude command.
 * @param {SelectionHandoffTexts} texts - Hand-off texts of the selection
 * @returns {string | null} - Reason, null while there is a command
 */
export const commandReason = (texts: SelectionHandoffTexts): string | null => {
  if (texts.command !== null) {
    return null
  }

  return texts.total === 1 ? NOT_OWN_REASON : NOT_ONE_REPOSITORY_REASON
}

/**
 * Returns why the prompt of the selection cannot be handed off.
 * @param {SelectionHandoffTexts | null} texts - Hand-off texts, null without checked rows
 * @returns {string | null} - Reason, null with checked rows
 */
export const selectionPromptReason = (texts: SelectionHandoffTexts | null): string | null =>
  texts === null ? NO_SELECTION_REASON : null

/**
 * Returns why the default action cannot run for the selection: no selection, Claude not
 * connected for a deep link, or a selection too large for one.
 * @param {SelectionHandoffTexts | null} texts - Hand-off texts, null without checked rows
 * @param {HandoffPreference} preferred - Default action
 * @param {string | null} connectReason - Why Claude cannot reach sieb, null while it can
 * @returns {string | null} - Reason, null while it can run
 */
export const selectionOpenReason = (
  texts: SelectionHandoffTexts | null,
  preferred: HandoffPreference,
  connectReason: string | null,
): string | null => {
  if (texts === null || preferred === 'copy') {
    return selectionPromptReason(texts)
  }

  return connectReason ?? linkReason(texts.links[HANDOFF_CLIENTS[preferred]])
}

/**
 * Returns why the claude command of the selection cannot be copied.
 * @param {SelectionHandoffTexts | null} texts - Hand-off texts, null without checked rows
 * @param {string | null} connectReason - Why Claude cannot reach sieb, null while it can
 * @returns {string | null} - Reason, null while it can be copied
 */
export const selectionCommandReason = (
  texts: SelectionHandoffTexts | null,
  connectReason: string | null,
): string | null => (texts === null ? NO_SELECTION_REASON : (commandReason(texts) ?? connectReason))
