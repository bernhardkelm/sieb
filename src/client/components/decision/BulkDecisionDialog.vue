<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { DecisionStatus } from '#core/decision.ts'
import BaseDialog from '@/components/common/BaseDialog.vue'
import DecisionForm from '@/components/decision/DecisionForm.vue'
import type {
  DecisionFormInitial,
  DecisionFormValue,
} from '@/components/decision/decisionFormModel'
import type { BulkTarget } from '@/components/decision/bulkTargets'
import { useDecisionCommands } from '@/composables/useDecisionCommands'
import { countOf, formatCount } from '@/format/count'

const props = defineProps<{
  targets: BulkTarget[]
  /** Preselected status, none is selected when absent */
  status?: DecisionStatus | null
  /** Starting form values such as status, justification and reason, over the status above */
  prefill?: DecisionFormInitial | null
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{ done: [] }>()

const commands = useDecisionCommands()
const form = ref<InstanceType<typeof DecisionForm> | null>(null)
const error = ref<unknown>(null)
const submitting = ref(false)

const initial = computed<DecisionFormInitial>(() => ({
  ...(props.status ? { status: props.status } : {}),
  ...props.prefill,
  scope: 'image',
}))

const allOpen = computed(
  () => props.targets.length === 1 && props.targets[0]?.imageRefs === 'all-open',
)
const images = computed(() =>
  props.targets.reduce(
    (sum, target) => sum + (target.imageRefs === 'all-open' ? 0 : target.imageRefs.length),
    0,
  ),
)
const submitLabel = computed(() =>
  allOpen.value ? 'Decide all' : `Decide ${formatCount(images.value)}`,
)

const description = computed(() => {
  if (allOpen.value) {
    return `${props.targets[0]?.vulnId} in every image with an open finding, one decision per image. Images decided already are skipped.`
  }

  const cves = props.targets.map((target) => target.vulnId).join(', ')

  return `${countOf(images.value, 'selected finding')} of ${cves}, one decision per image.`
})

/**
 * Writes the bulk decisions and closes the dialog on success.
 * @param {DecisionFormValue} value - Form values
 * @returns {Promise<void>} - Resolves when written or failed
 */
const onSubmit = async (value: DecisionFormValue): Promise<void> => {
  submitting.value = true
  error.value = null

  try {
    await commands.bulkDecide(props.targets, value)
    open.value = false
    emit('done')
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
    v-model:open="open"
    title="Bulk decide"
    :description="description"
    @open-auto-focus="onOpenAutoFocus"
  >
    <DecisionForm
      ref="form"
      :scope-choice="false"
      :initial="initial"
      :error="error"
      :submitting="submitting"
      :submit-label="submitLabel"
      @submit="onSubmit"
      @cancel="open = false"
    />
  </BaseDialog>
</template>
