import { MULTI_HANDOFF_CAP } from '#core/multiHandoffPrompt.ts'
import type { SelectionHandoffTexts } from '#core/selectionHandoff.ts'
import { pluralize } from '@/format/count'
import { PASTE_PROMPT_NOTE, runCommandNote } from '@/format/handoffNotices'

export const CAPPED_REASON = `A prompt lists at most ${MULTI_HANDOFF_CAP} findings.`

/**
 * Names the findings a hand-off of the selection carries.
 * @param {SelectionHandoffTexts} texts - Hand-off texts of the selection
 * @returns {string} - Such as "4 findings", or "20 of 25 findings" beyond the cap
 */
export const handedOffCount = (texts: SelectionHandoffTexts): string =>
  texts.listed < texts.total
    ? `${texts.listed} of ${texts.total} findings`
    : `${texts.total} ${pluralize(texts.total, 'finding')}`

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
  const next = kind === 'prompt' ? PASTE_PROMPT_NOTE : runCommandNote(texts.total)

  return { title: `Copied ${kind} for ${count}`, description: `${capped}${next}` }
}
