<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import type { ProposalDetail } from '#core/apiTypes.ts'
import DecisionForm from '@/components/decision/DecisionForm.vue'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'
import { editInitial } from '@/components/proposals/acceptEdits'
import { countOf } from '@/format/count'
import { shortImageName } from '@/format/imageName'

const props = defineProps<{
  detail: ProposalDetail
  /** Failure of the last accept, validation errors per field */
  error: unknown
  submitting: boolean
}>()

const emit = defineEmits<{ submit: [value: DecisionFormValue]; cancel: []; dirty: [boolean] }>()

const form = ref<InstanceType<typeof DecisionForm> | null>(null)
const initial = computed(() => editInitial(props.detail.decisionValues))
const target = computed(() => {
  const refs = props.detail.proposal.imageRefs

  if (refs === null) {
    return 'all images of this CVE, including future ones'
  }

  return refs.length <= 3 ? refs.map(shortImageName).join(', ') : countOf(refs.length, 'image')
})

onMounted(async () => {
  await nextTick()
  form.value?.focusReason()
})
</script>

<template>
  <div class="proposal-edit-form">
    <p class="scope">
      Applies to {{ target }}. Scope and images stay as proposed, reject the proposal to change
      them.
    </p>
    <DecisionForm
      ref="form"
      :initial="initial"
      :scope-choice="false"
      :error="error"
      :submitting="submitting"
      submit-label="Accept with edits"
      sticky-actions
      @submit="emit('submit', $event)"
      @cancel="emit('cancel')"
      @dirty="emit('dirty', $event)"
    />
  </div>
</template>

<style scoped>
.proposal-edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) 0;
  border-top: var(--border-width) solid var(--color-border);
}

.scope {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}
</style>
