<script setup lang="ts">
import type { CheckView } from '#core/check.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import BlockableButton from '@/components/common/BlockableButton.vue'
import { useCheckRetry } from '@/composables/useCheckRetry'

const props = defineProps<{
  /** Failed or cancelled check, the button hides for any other */
  check: CheckView
}>()

const { available, blockedBy, submitting, retry } = useCheckRetry(() => props.check)
</script>

<template>
  <BlockableButton
    v-if="available"
    :as="BaseButton"
    class="retry-check"
    variant="ghost"
    :aria-label="`Retry the Auto-check of ${check.vulnId}`"
    :blocked-by="blockedBy"
    blocked-title="No Auto-check queued"
    :busy="submitting"
    hint="Queue this finding for a new Auto-check"
    :data-retry-check="check.id"
    @click.stop
    @press="retry()"
  >
    Retry
  </BlockableButton>
</template>
