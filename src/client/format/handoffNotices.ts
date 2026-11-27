import { pluralize } from '@/format/count'

export const PASTE_PROMPT_NOTE = 'Paste the prompt into Claude.'

/**
 * Returns where to run a copied claude command.
 * @param {number} findings - Findings the command covers
 * @returns {string} - Such as "Run it in the repository that builds the images."
 */
export const runCommandNote = (findings: number): string =>
  `Run it in the repository that builds the ${pluralize(findings, 'image')}.`
