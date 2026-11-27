<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ProposalInboxItem } from '#core/inbox/inboxItem.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { acceptSkipOf } from '@/components/inbox/inboxBulkTargets'
import { countOf } from '@/format/count'

const props = defineProps<{
  /** Checked proposals, the skipped ones included */
  proposals: ProposalInboxItem[]
  busy: boolean
}>()

const open = defineModel<boolean>('open', { required: true })

defineEmits<{ confirm: [] }>()

const confirmButton = ref<InstanceType<typeof BaseButton> | null>(null)

const acceptable = computed(
  () => props.proposals.filter((item) => acceptSkipOf(item) === null).length,
)
const skipNote = computed(() => {
  const outdated = props.proposals.filter((item) => acceptSkipOf(item) === 'outdated').length
  const inconclusive = props.proposals.filter(
    (item) => acceptSkipOf(item) === 'inconclusive',
  ).length
  const parts = [
    outdated > 0 ? `${outdated} outdated` : null,
    inconclusive > 0 ? `${inconclusive} inconclusive` : null,
  ].filter((part) => part !== null)

  return parts.length === 0
    ? null
    : `Skipped: ${parts.join(', ')}. They stay selected, review them one by one.`
})

/**
 * Focuses the confirm button instead of the close button when the dialog opens.
 * @param {Event} event - Auto focus event of the dialog
 * @returns {void}
 */
const onOpenAutoFocus = (event: Event): void => {
  event.preventDefault()
  ;(confirmButton.value?.$el as HTMLButtonElement | undefined)?.focus()
}
</script>

<template>
  <BaseDialog
    v-model:open="open"
    :title="`Accept ${countOf(acceptable, 'proposal')}?`"
    description="Each one becomes its decision as Claude proposed it, without edits. A decision someone changed meanwhile is never overwritten."
    @open-auto-focus="onOpenAutoFocus"
  >
    <p v-if="skipNote" class="skip-note">{{ skipNote }}</p>
    <div class="actions">
      <BaseButton :disabled="busy" @click="open = false">Cancel</BaseButton>
      <BaseButton ref="confirmButton" variant="primary" :disabled="busy" @click="$emit('confirm')">
        Accept {{ acceptable }}
      </BaseButton>
    </div>
  </BaseDialog>
</template>

<style scoped>
.skip-note {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
