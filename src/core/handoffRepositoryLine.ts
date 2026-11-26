import type { HandoffClient } from '#core/handoffLinks.ts'
import { repositoryHint } from '#core/repositoryHint.ts'

/** Where a hand-off prompt runs: a client kind, or Claude Code inside the image's repository */
export type HandoffContext = HandoffClient | 'repository'

/**
 * Returns the sentence that points Claude at the source of an own image: the working directory
 * for the claude command run in the repository, the working directory or a path to ask for in
 * Claude Code, nothing in the chat and for images of others.
 * @param {string} imageRef - Single-line image ref
 * @param {HandoffContext} context - Where the prompt runs
 * @param {boolean} own - Whether the image is built from own repositories
 * @returns {string} - Sentence with a leading space, empty without one
 */
export const repositoryLine = (imageRef: string, context: HandoffContext, own: boolean): string => {
  if (context === 'repository') {
    return ` This repository builds ${imageRef}; check the code here.`
  }

  if (context === 'chat' || !own) {
    return ''
  }

  const hint = repositoryHint(imageRef)
  const source = hint === null ? 'its repository' : 'that repository'
  const probably = hint === null ? '' : `, repository probably ${hint}`

  return (
    ` Own image${probably}: check the code in the working directory if it is ${source},` +
    ' else ask me for its local path.'
  )
}
