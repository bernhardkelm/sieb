import type { InjectionKey } from 'vue'

/**
 * Selector of the element a scroll container provides for the sticky Save bar of a decision form
 * inside it. The bar then sits next to the section that holds the form instead of inside the
 * form, so sticky can lift it to the bottom edge however close to it the form starts.
 */
export const STICKY_ACTIONS_TARGET: InjectionKey<string> = Symbol('stickyActionsTarget')
