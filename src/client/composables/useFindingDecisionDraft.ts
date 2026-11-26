import { computed, nextTick, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'

import type { DecisionStatus } from '#core/decision.ts'
import type { FindingDetail } from '#core/findingView.ts'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'
import { useDecisionCommands } from '@/composables/useDecisionCommands'
import type { DecisionFormModeState } from '@/composables/useDecisionFormMode'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

export interface DecisionFormHandle {
  setStatus: (status: DecisionStatus) => void
  focusReason: () => void
}

export interface FindingDecisionDraftOptions {
  detail: () => FindingDetail
  modes: DecisionFormModeState
  form: Readonly<Ref<DecisionFormHandle | null>>
  onSaved: () => void
}

export interface FindingDecisionDraft {
  /** Failure of the last save */
  error: Ref<unknown>
  submitting: Ref<boolean>
  /** Whether the mounted form reports unsaved input */
  formDirty: Ref<boolean>
  /** Whether the shown form holds an unsaved draft */
  draftDirty: ComputedRef<boolean>
  /** Whether navigations ask before they drop the draft, not while it saves */
  draftGuarded: ComputedRef<boolean>
  submit: (value: DecisionFormValue) => Promise<void>
  cancel: () => void
}

/**
 * Drives the draft in the decision form of the finding panel: saves it through the decision
 * commands, drops it on Cancel or when the panel moves to another finding, opens the form a
 * shortcut requested for the panel finding, and reports an unsaved draft to the detail store,
 * which pauses the list keys.
 * @param {FindingDecisionDraftOptions} options - Detail, form mode, form handle and saved hook
 * @returns {FindingDecisionDraft} - Draft state and the form handlers
 */
export const useFindingDecisionDraft = (
  options: FindingDecisionDraftOptions,
): FindingDecisionDraft => {
  const { detail, modes, form } = options
  const store = useFindingDetailStore()
  const commands = useDecisionCommands()
  const error = ref<unknown>(null)
  const submitting = ref(false)
  const formDirty = ref(false)
  let handledToken = 0

  const draftDirty = computed(() => modes.showForm.value && formDirty.value)
  const draftGuarded = computed(() => draftDirty.value && !submitting.value)

  /**
   * Opens the form for a status and focuses the reason.
   * @param {DecisionStatus} status - Preselected status
   * @returns {Promise<void>} - Resolves once focused
   */
  const openForm = async (status: DecisionStatus): Promise<void> => {
    modes.openForImage()
    error.value = null
    await nextTick()
    form.value?.setStatus(status)
    form.value?.focusReason()
  }

  /**
   * Saves the form, keeping the scope of an edited decision.
   * @param {DecisionFormValue} value - Form values
   * @returns {Promise<void>} - Resolves when saved or failed
   */
  const submit = async (value: DecisionFormValue): Promise<void> => {
    const mode = modes.mode.value
    const existing = mode?.kind === 'edit' ? mode.decision : null

    submitting.value = true
    error.value = null

    try {
      await commands.save(detail().finding, existing, {
        ...value,
        scope: existing?.scope ?? value.scope,
      })
      modes.mode.value = null
      formDirty.value = false
      options.onSaved()
    } catch (failure) {
      error.value = failure
    } finally {
      submitting.value = false
    }
  }

  /**
   * Drops the draft, a form that stays for a finding without decision starts empty.
   * @returns {void}
   */
  const cancel = (): void => {
    modes.dropDraft()
    formDirty.value = false
  }

  watch(
    [() => store.decisionRequest, () => detail().finding.id],
    ([request, findingId], previous) => {
      if (previous !== undefined && previous[1] !== findingId) {
        modes.mode.value = null
        error.value = null
        formDirty.value = false
      }

      if (request && request.token !== handledToken && request.findingId === findingId) {
        handledToken = request.token
        void openForm(request.status)
      }
    },
    { immediate: true },
  )

  watch(
    draftDirty,
    (dirty) => {
      store.setDraftDirty(dirty)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    store.setDraftDirty(false)
  })

  return { error, submitting, formDirty, draftDirty, draftGuarded, submit, cancel }
}
