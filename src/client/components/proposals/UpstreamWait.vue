<script setup lang="ts">
import { formatDate } from '@/format/relativeTime'
import { waitingForText } from '@/format/upstreamText'

defineProps<{
  /** Claude-written release or image the fix waits for */
  waitingFor: string | null
  /** Proposed review date, ISO in UTC */
  reviewDate: string | null
}>()
</script>

<template>
  <div class="upstream-wait">
    <p class="waiting">{{ waitingForText(waitingFor) }}</p>
    <p class="review">Review by {{ reviewDate ? formatDate(reviewDate) : 'no date proposed' }}</p>
  </div>
</template>

<style scoped>
.upstream-wait {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
}

.waiting {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  overflow-wrap: anywhere;
}

.review {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
