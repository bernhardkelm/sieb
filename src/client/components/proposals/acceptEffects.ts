import type { ProposalDetail, ProposalImageFacts } from '#core/apiTypes.ts'
import type { DecisionStatus } from '#core/decision.ts'
import { leavesInbox } from '#core/effectiveDecision.ts'
import type { DecisionView } from '#core/findingView.ts'
import { countOf } from '@/format/count'
import { shortImageName } from '@/format/imageName'
import { STATE_LABELS, STATUS_LABELS } from '@/format/labels'
import { formatDate } from '@/format/relativeTime'

/** One consequence of accepting, kind drives the emphasis */
export interface AcceptEffect {
  kind: 'mute' | 'alerts' | 'triage' | 'replace' | 'scope' | 'expiry'
  text: string
}

/**
 * Returns the label of a current decision, with its state when it is not in effect.
 * @param {DecisionView} view - Current decision
 * @returns {string} - Such as "Fix planned" or "Accepted (expired)"
 */
const currentLabel = (view: DecisionView): string =>
  leavesInbox(view.effective)
    ? STATUS_LABELS[view.decision.status]
    : `${STATUS_LABELS[view.decision.status]} (${STATE_LABELS[view.effective.state].toLowerCase()})`

/**
 * Describes what writing a decision with a status does to the current decision of one target.
 * @param {DecisionView} view - Current decision of the target
 * @param {DecisionStatus} status - Status accepting writes
 * @param {string} where - Target, such as "image nginx" or "all images"
 * @returns {AcceptEffect} - Replace effect
 */
const replaceEffect = (view: DecisionView, status: DecisionStatus, where: string): AcceptEffect =>
  view.decision.status === status && leavesInbox(view.effective)
    ? {
        kind: 'replace',
        text: `Updates and re-confirms the current decision ${currentLabel(view)} on ${where}`,
      }
    : {
        kind: 'replace',
        text: `Replaces the current decision ${currentLabel(view)} → ${STATUS_LABELS[status]} on ${where}`,
      }

/**
 * Describes the change per target image of an image-scoped proposal: an image decision replaces
 * or updates the current one, and takes precedence over an all-images decision.
 * @param {ProposalImageFacts[]} images - Target images
 * @param {DecisionStatus} status - Status accepting writes
 * @returns {AcceptEffect[]} - One effect per image with a current decision
 */
const imageReplacements = (images: ProposalImageFacts[], status: DecisionStatus): AcceptEffect[] =>
  images.flatMap((image) => {
    const view = image.decision
    const where = `image ${shortImageName(image.imageRef)}`

    if (view === null) {
      return []
    }

    if (view.decision.scope === 'all') {
      return [
        {
          kind: 'replace' as const,
          text: `Overrides the all-images decision ${currentLabel(view)} with ${STATUS_LABELS[status]} on ${where}`,
        },
      ]
    }

    return [replaceEffect(view, status, where)]
  })

/**
 * Lists what accepting a proposal without edits does: muted alerts, findings leaving Triage,
 * replaced decisions, the reach of scope all and the expiry; nothing for an inconclusive one,
 * which cannot be accepted as proposed.
 * @param {ProposalDetail} detail - Proposal detail
 * @returns {AcceptEffect[]} - Effects in reading order
 */
export const acceptEffects = (detail: ProposalDetail): AcceptEffect[] => {
  if (detail.decisionValues === null) {
    return []
  }

  const { status, expiresAt } = detail.decisionValues
  const all = detail.proposal.scope === 'all'
  const affected = detail.images.filter(
    (image) =>
      image.open && (!all || image.decision === null || image.decision.decision.scope === 'all'),
  )
  const kept = all ? detail.images.filter((image) => image.open).length - affected.length : 0
  const inTriage = affected.filter(
    (image) => image.decision === null || !leavesInbox(image.decision.effective),
  ).length
  const effects: AcceptEffect[] = []

  effects.push(
    status === 'fix_planned'
      ? {
          kind: 'alerts',
          text: 'Alerts keep firing, Fix planned only takes the findings out of Triage',
        }
      : { kind: 'mute', text: `Mutes alerts for ${countOf(affected.length, 'image')}` },
  )

  if (inTriage > 0) {
    effects.push({ kind: 'triage', text: `Removes ${countOf(inTriage, 'finding')} from Triage` })
  }

  if (all) {
    effects.push({
      kind: 'scope',
      text: 'Applies to all images of this CVE, including future ones',
    })

    if (kept > 0) {
      effects.push({
        kind: 'scope',
        text: `${countOf(kept, 'image')} ${kept === 1 ? 'keeps its' : 'keep their'} own image decision`,
      })
    }

    if (detail.allScopeDecision !== null) {
      effects.push(replaceEffect(detail.allScopeDecision, status, 'all images'))
    }
  } else {
    effects.push(...imageReplacements(detail.images, status))
  }

  effects.push({
    kind: 'expiry',
    text: expiresAt === null ? 'Never expires' : `Expires ${formatDate(expiresAt)}`,
  })
  return effects
}
