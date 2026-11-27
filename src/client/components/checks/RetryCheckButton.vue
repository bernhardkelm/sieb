<script setup lang="ts">
import { computed } from 'vue'

import type { CheckView } from '#core/check.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import { useCheckRetry } from '@/composables/useCheckRetry'

const props = defineProps<{
  /** Failed or cancelled check, the button hides for any other */
  check: CheckView
}>()

const { available, blockedBy, submitting, retry } = useCheckRetry(() => props.check)

const blocked = computed(() => blockedBy.value !== null || submitting.value)
</script>

<template>
  <BaseButton
    v-if="available"
    class="retry-check"
    variant="ghost"
    :aria-label="`Retry the Auto-check of ${check.vulnId}`"
    :aria-disabled="blocked || undefined"
    :aria-busy="submitting || undefined"
    :title="blockedBy ?? 'Queue this finding for a new Auto-check'"
    :data-retry-check="check.id"
    @click.stop="retry()"
  >
    Retry
  </BaseButton>
</template>

<style scoped>
.retry-check[aria-disabled='true'] {
  cursor: default;
  opacity: 0.55;
}
</style>
