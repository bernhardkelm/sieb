<script setup lang="ts">
import BaseDialog from '@/components/common/BaseDialog.vue'
import RejectReasonForm from '@/components/proposals/RejectReasonForm.vue'
import { countOf } from '@/format/count'

defineProps<{
  /** Proposals the reason goes to */
  count: number
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
    :title="`Reject ${countOf(count, 'proposal')}?`"
    description="Every selected proposal gets this reason. Claude reads it back when it lists its proposals, so say what is wrong or missing."
  >
    <RejectReasonForm
      :busy="busy"
      :error="error"
      :submit-label="`Reject ${count}`"
      submit-variant="danger"
      @confirm="$emit('confirm', $event)"
      @cancel="open = false"
    />
  </BaseDialog>
</template>
