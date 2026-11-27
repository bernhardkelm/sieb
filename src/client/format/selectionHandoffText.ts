import type { MultiLinkPrompt } from '#core/multiHandoffLink.ts'
import { MULTI_HANDOFF_CAP } from '#core/multiHandoffPrompt.ts'
import type { SelectionHandoffTexts } from '#core/selectionHandoff.ts'

export const NO_SELECTION_REASON = 'Select findings first'
export const NOT_ONE_REPOSITORY_REASON = 'Only for own images of one repository'
export const NOT_OWN_SELECTION_REASON = 'Only for own images'
export const CAPPED_REASON = `A prompt lists at most ${MULTI_HANDOFF_CAP} findings.`

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

  return texts.total === 1 ? NOT_OWN_SELECTION_REASON : NOT_ONE_REPOSITORY_REASON
}

/**
 * Names the findings a hand-off of the selection carries.
 * @param {SelectionHandoffTexts} texts - Hand-off texts of the selection
 * @returns {string} - Such as "4 findings", or "20 of 25 findings" beyond the cap
 */
export const handedOffCount = (texts: SelectionHandoffTexts): string =>
  texts.listed < texts.total
    ? `${texts.listed} of ${texts.total} findings`
    : `${texts.total} finding${texts.total === 1 ? '' : 's'}`

/**
 * Returns the title of the toast while a deep link opens Claude with the selection.
 * @param {SelectionHandoffTexts} texts - Hand-off texts of the selection
 * @returns {string} - Such as "Opening Claude with 4 findings…"
 */
export const openingTitle = (texts: SelectionHandoffTexts): string =>
  `Opening Claude with ${handedOffCount(texts)}…`

/**
 * Describes what a copy of the selection holds, for the confirming toast.
 * @param {SelectionHandoffTexts} texts - Hand-off texts of the selection
 * @param {'prompt' | 'claude command'} kind - Copied text
 * @returns {{ title: string; description: string }} - Toast title and description
 */
export const copiedToast = (
  texts: SelectionHandoffTexts,
  kind: 'prompt' | 'claude command',
): { title: string; description: string } => {
  const count = handedOffCount(texts)
  const capped = texts.listed < texts.total ? `${CAPPED_REASON} ` : ''
  const next =
    kind === 'prompt'
      ? 'Paste the prompt into Claude.'
      : `Run it in the repository that builds the image${texts.total === 1 ? '' : 's'}.`

  return { title: `Copied ${kind} for ${count}`, description: `${capped}${next}` }
}
