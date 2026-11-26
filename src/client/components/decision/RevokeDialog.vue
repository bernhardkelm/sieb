<script setup lang="ts">
import { ref, useId, watch } from 'vue'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { TEXT_MAX_LENGTH } from '@/components/decision/decisionFormModel'

defineProps<{
  vulnId: string
  /** Scope of the decision, such as an image name or "all images" */
  target?: string
  busy?: boolean
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{ confirm: [comment: string] }>()

const id = useId()
const comment = ref('')

watch(open, (value) => {
  if (value) {
    comment.value = ''
  }
})
</script>

<template>
  <ConfirmDialog
    v-model:open="open"
    :title="`Revoke the decision on ${vulnId}${target ? ` for ${target}` : ''}?`"
    description="Its findings return to Triage and count again within about two minutes; a matching alert fires after the usual 30 minutes."
    confirm-label="Revoke"
    :busy="busy"
    @confirm="emit('confirm', comment)"
  >
    <label :for="id" class="label">Comment (optional)</label>
    <textarea :id="id" v-model="comment" class="comment" :maxlength="TEXT_MAX_LENGTH" />
  </ConfirmDialog>
</template>

<style scoped>
.label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.comment {
  min-height: var(--textarea-min-height);
  padding: var(--space-2);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
  resize: vertical;
}
</style>
