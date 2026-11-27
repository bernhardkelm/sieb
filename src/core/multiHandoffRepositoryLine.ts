import type { FindingView } from '#core/findingView.ts'
import { isOwnImage } from '#core/handoffPrompt.ts'
import type { HandoffContext } from '#core/handoffRepositoryLine.ts'
import { repositoryHint, repositoryOf } from '#core/repositoryHint.ts'

/** Fields of a finding the multi-finding hand-off reads */
export type MultiHandoffFinding = Pick<FindingView, 'id' | 'vulnId' | 'imageRef' | 'owner'>

/**
 * Returns the one repository all findings' images are built from, by the registry hint or else
 * by the image repository without tag, null when they are not all own images of one repository.
 * @param {readonly MultiHandoffFinding[]} findings - Findings
 * @returns {string | null} - Repository key, null for mixed or foreign images
 */
export const sharedOwnRepository = (findings: readonly MultiHandoffFinding[]): string | null => {
  if (findings.length === 0 || !findings.every(isOwnImage)) {
    return null
  }

  const keys = new Set(
    findings.map((finding) => {
      const ref = finding.imageRef.trim().toLowerCase()

      return repositoryHint(ref) ?? repositoryOf(ref)
    }),
  )

  return keys.size === 1 ? ([...keys][0] ?? null) : null
}

/**
 * Returns the hint all own images share, null when they differ or none has one.
 * @param {readonly MultiHandoffFinding[]} findings - Own findings
 * @returns {string | null} - Repository hint such as gitlab.com/group/project
 */
const sharedHint = (findings: readonly MultiHandoffFinding[]): string | null => {
  const hints = new Set(findings.map((finding) => repositoryHint(finding.imageRef)))

  return hints.size === 1 ? ([...hints][0] ?? null) : null
}

/**
 * Returns the sentence that points Claude at the source of the images: the working directory
 * for the claude command, for Claude Code the shared repository hint of own images or a generic
 * line when they differ, nothing in the chat or while any image belongs to others.
 * @param {readonly MultiHandoffFinding[]} findings - Findings in the prompt
 * @param {HandoffContext} context - Where the prompt runs
 * @returns {string} - Sentence with a leading space, empty without one
 */
export const multiRepositoryLine = (
  findings: readonly MultiHandoffFinding[],
  context: HandoffContext,
): string => {
  if (context === 'repository') {
    return ' This repository builds these images; check the code here.'
  }

  if (context === 'chat' || findings.length === 0 || !findings.every(isOwnImage)) {
    return ''
  }

  const hint = sharedHint(findings)

  if (hint === null) {
    return (
      ' Own images: check the code in the working directory if it builds them, else ask me for' +
      ' their local paths.'
    )
  }

  return (
    ` Own images, repository probably ${hint}: check the code in the working directory if it is` +
    ' that repository, else ask me for its local path.'
  )
}
