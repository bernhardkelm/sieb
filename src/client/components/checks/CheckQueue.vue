<script setup lang="ts">
import type { CheckView } from '#core/check.ts'
import CheckFinding from '@/components/checks/CheckFinding.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import SectionHeading from '@/components/common/SectionHeading.vue'

defineProps<{
  /** Queued checks in queue order */
  checks: CheckView[]
}>()

defineEmits<{ cancel: [check: CheckView] }>()
</script>

<template>
  <section class="check-section" aria-labelledby="checks-queue">
    <SectionHeading id="checks-queue" :level="2" :count="checks.length">Queue</SectionHeading>
    <ol v-if="checks.length > 0" class="items">
      <li v-for="check in checks" :key="check.id" class="item" :data-check-id="check.id">
        <span class="position">#{{ check.position ?? '?' }}</span>
        <CheckFinding :check="check" />
        <span class="meta">
          requested by {{ check.requestedBy }} · <RelativeTime :value="check.createdAt" />
        </span>
        <BaseButton
          class="push"
          :aria-label="`Cancel the queued check of ${check.vulnId}`"
          @click="$emit('cancel', check)"
        >
          Cancel
        </BaseButton>
      </li>
    </ol>
    <p v-else class="none">The queue is empty.</p>
  </section>
</template>

<style scoped src="@/components/checks/checkSection.css"></style>

<style scoped>
.position {
  min-width: var(--count-width);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}
</style>
