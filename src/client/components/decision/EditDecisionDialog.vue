<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { DecisionView } from '#core/findingView.ts'
import BaseDialog from '@/components/common/BaseDialog.vue'
import DecisionForm from '@/components/decision/DecisionForm.vue'
import {
  initialFromDecision,
  type DecisionFormValue,
} from '@/components/decision/decisionFormModel'
import { useDecisionCommands } from '@/composables/useDecisionCommands'
import { scopeLabel } from '@/format/scopeLabel'

const props = defineProps<{
  /** Decision to edit, null renders nothing */
  view: DecisionView | null
}>()

const open = defineModel<boolean>('open', { required: true })

const commands = useDecisionCommands()
const form = ref<InstanceType<typeof DecisionForm> | null>(null)
const error = ref<unknown>(null)
const submitting = ref(false)

const description = computed(() => {
  const decision = props.view?.decision

  if (!decision) {
    return ''
  }

  return `${decision.vulnId} for ${scopeLabel(decision)}`
})

/**
 * Saves status, reason and expiry of the decision, keeping its scope.
 * @param {DecisionFormValue} value - Form values
 * @returns {Promise<void>} - Resolves when saved or failed
 */
const onSubmit = async (value: DecisionFormValue): Promise<void> => {
  const decision = props.view?.decision

  if (!decision) {
    return
  }

  submitting.value = true
  error.value = null

  try {
    await commands.save({ vulnId: decision.vulnId, imageRef: decision.imageRef ?? '' }, decision, {
      ...value,
      scope: decision.scope,
    })
    open.value = false
  } catch (failure) {
    error.value = failure
  } finally {
    submitting.value = false
  }
}

/**
 * Focuses the reason instead of the first control when the dialog opens.
 * @param {Event} event - Auto focus event of the dialog
 * @returns {void}
 */
const onOpenAutoFocus = (event: Event): void => {
  event.preventDefault()
  form.value?.focusReason()
}

watch(open, (value) => {
  if (value) {
    error.value = null
  }
})
</script>

<template>
  <BaseDialog
    v-if="view"
    v-model:open="open"
    title="Edit decision"
    :description="description"
    @open-auto-focus="onOpenAutoFocus"
  >
    <DecisionForm
      ref="form"
      :key="view.decision.id"
      :initial="initialFromDecision(view.decision, new Date())"
      :scope-choice="false"
      :error="error"
      :submitting="submitting"
      :reconfirmable="view.effective.state === 'reopened'"
      submit-label="Save changes"
      @submit="onSubmit"
      @cancel="open = false"
    />
  </BaseDialog>
</template>
