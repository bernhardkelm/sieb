<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { CveAggregate } from '#core/cveAggregation.ts'
import BaseDialog from '@/components/common/BaseDialog.vue'
import DecisionForm from '@/components/decision/DecisionForm.vue'
import {
  initialFromDecision,
  type DecisionFormInitial,
  type DecisionFormValue,
} from '@/components/decision/decisionFormModel'
import { useDecisionCommands } from '@/composables/useDecisionCommands'
import { countOf } from '@/format/count'

const props = defineProps<{
  /** CVE to decide, null renders nothing */
  cve: CveAggregate | null
}>()

const open = defineModel<boolean>('open', { required: true })

const commands = useDecisionCommands()
const form = ref<InstanceType<typeof DecisionForm> | null>(null)
const error = ref<unknown>(null)
const submitting = ref(false)

const existing = computed(() => props.cve?.allScopeDecision ?? null)
const initial = computed<DecisionFormInitial>(() =>
  existing.value ? initialFromDecision(existing.value, new Date()) : { scope: 'all' },
)
const title = computed(() =>
  existing.value
    ? `Edit the decision on ${props.cve?.vulnId} for all images`
    : `Decide ${props.cve?.vulnId}`,
)
const imageLabel = computed(() => `the ${countOf(props.cve?.imageCount ?? 0, 'current image')}`)

/**
 * Writes the decision: scope all creates or changes the all-scope decision, which also covers
 * images that show up later; scope image decides every open image of the CVE one by one.
 * @param {DecisionFormValue} value - Form values
 * @returns {Promise<void>} - Resolves when written or failed
 */
const onSubmit = async (value: DecisionFormValue): Promise<void> => {
  const cve = props.cve

  if (!cve) {
    return
  }

  submitting.value = true
  error.value = null

  try {
    if (value.scope === 'all') {
      await commands.save({ vulnId: cve.vulnId, imageRef: '' }, existing.value, value)
    } else {
      await commands.bulkDecide([{ vulnId: cve.vulnId, imageRefs: 'all-open' }], value)
    }

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
    v-if="cve"
    v-model:open="open"
    :title="title"
    description="A decision for all images also covers images that show up later; an image's own decision keeps precedence."
    @open-auto-focus="onOpenAutoFocus"
  >
    <DecisionForm
      ref="form"
      :key="`${cve.vulnId}-${existing?.id ?? 'new'}`"
      :initial="initial"
      :scope-choice="existing === null"
      :image-label="imageLabel"
      :error="error"
      :submitting="submitting"
      :submit-label="existing ? 'Save changes' : 'Decide'"
      :reconfirmable="existing !== null && existing.reopenedAt !== null"
      @submit="onSubmit"
      @cancel="open = false"
    />
  </BaseDialog>
</template>
