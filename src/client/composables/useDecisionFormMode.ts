import { computed, ref, type ComputedRef, type Ref } from 'vue'

import type { Decision } from '#core/decision.ts'
import type { DecisionView, FindingDetail } from '#core/findingView.ts'
import {
  initialFromDecision,
  type DecisionFormInitial,
} from '@/components/decision/decisionFormModel'

/** What the decision form of the panel does, null while it is closed */
export type DecisionFormMode = { kind: 'create' } | { kind: 'edit'; decision: Decision } | null

export interface DecisionFormModeState {
  mode: Ref<DecisionFormMode>
  /** Decisions of the finding that are not revoked */
  current: ComputedRef<DecisionView[]>
  /** Image decision of the finding, null without one */
  imageDecision: ComputedRef<Decision | null>
  hasAllDecision: ComputedRef<boolean>
  formInitial: ComputedRef<DecisionFormInitial>
  /** Remounts the form for another decision, finding or a dropped draft */
  formKey: ComputedRef<string>
  /** Whether the form shows: while open, and always for a finding without decision */
  showForm: ComputedRef<boolean>
  /** Whether the edited decision is re-opened, so the form offers to re-confirm it */
  editReopened: ComputedRef<boolean>
  /** Opens the form on the image decision of the finding, or for a new one without */
  openForImage: () => void
  /** Closes the form and lets the next one start empty */
  dropDraft: () => void
}

/**
 * Tracks whether the decision form of the finding panel creates a decision, edits one or is
 * closed, and derives what the form starts from.
 * @param {() => FindingDetail} detail - Detail of the panel finding
 * @returns {DecisionFormModeState} - Mode, its derived values and the mode changes
 */
export const useDecisionFormMode = (detail: () => FindingDetail): DecisionFormModeState => {
  const mode = ref<DecisionFormMode>(null)
  const drafts = ref(0)

  const current = computed(() =>
    detail().decisions.filter((view) => view.effective.state !== 'revoked'),
  )
  const imageDecision = computed(
    () => current.value.find((view) => view.decision.scope === 'image')?.decision ?? null,
  )
  const hasAllDecision = computed(() => current.value.some((view) => view.decision.scope === 'all'))
  const formInitial = computed<DecisionFormInitial>(() =>
    mode.value?.kind === 'edit'
      ? initialFromDecision(mode.value.decision, new Date())
      : { scope: 'image' },
  )
  const formKey = computed(() =>
    mode.value?.kind === 'edit'
      ? `edit-${mode.value.decision.id}-${drafts.value}`
      : `create-${detail().finding.id}-${drafts.value}`,
  )
  const showForm = computed(() => mode.value !== null || current.value.length === 0)
  const editReopened = computed(() => {
    const edited = mode.value?.kind === 'edit' ? mode.value.decision.id : null

    return current.value.some(
      (view) => view.decision.id === edited && view.effective.state === 'reopened',
    )
  })

  /**
   * Opens the form on the image decision, or for a new one.
   * @returns {void}
   */
  const openForImage = (): void => {
    mode.value = imageDecision.value
      ? { kind: 'edit', decision: imageDecision.value }
      : { kind: 'create' }
  }

  /**
   * Closes the form and remounts the one that stays for a finding without decision.
   * @returns {void}
   */
  const dropDraft = (): void => {
    mode.value = null
    drafts.value += 1
  }

  return {
    mode,
    current,
    imageDecision,
    hasAllDecision,
    formInitial,
    formKey,
    showForm,
    editReopened,
    openForImage,
    dropDraft,
  }
}
