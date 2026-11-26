import type { Decision } from '#core/decision.ts'
import { shortImageName } from '@/format/imageName'

/**
 * Names what a decision covers.
 * @param {Pick<Decision, 'imageRef'>} decision - Decision
 * @returns {string} - Short image name, or "all images" for scope all
 */
export const scopeLabel = (decision: Pick<Decision, 'imageRef'>): string =>
  decision.imageRef ? shortImageName(decision.imageRef) : 'all images'
