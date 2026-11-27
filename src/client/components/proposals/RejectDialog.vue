<script setup lang="ts">
import BaseDialog from '@/components/common/BaseDialog.vue'
import RejectReasonForm from '@/components/proposals/RejectReasonForm.vue'

defineProps<{
  vulnId: string
  /** Dismisses an inconclusive proposal, same command and reason rule as a reject */
  dismiss?: boolean
  busy: boolean
  /** Failure of the last reject, validation errors of the reason are shown */
  error: unknown
}>()

const open = defineModel<boolean>('open', { required: true })

defineEmits<{ confirm: [reason: string] }>()
</script>

<template>
  <BaseDialog
    v-model:open="open"
    :title="`${dismiss ? 'Dismiss' : 'Reject'} the proposal for ${vulnId}?`"
    :description="
      dismiss
        ? 'Nothing is decided. Claude reads your reason back when it lists its proposals.'
        : 'Claude reads your reason back when it lists its proposals, so say what is wrong or missing.'
    "
  >
    <RejectReasonForm
      :busy="busy"
      :error="error"
      :submit-label="dismiss ? 'Dismiss' : 'Reject'"
      :submit-variant="dismiss ? 'primary' : 'danger'"
      @confirm="$emit('confirm', $event)"
      @cancel="open = false"
    />
  </BaseDialog>
</template>
