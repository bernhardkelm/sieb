<script setup lang="ts">
import type { CheckView } from '#core/check.ts'
import CheckChip from '@/components/checks/CheckChip.vue'
import CheckFinding from '@/components/checks/CheckFinding.vue'
import BaseButton from '@/components/common/BaseButton.vue'

defineProps<{
  check: CheckView | null
  workerOnline: boolean
}>()

defineEmits<{ cancel: [check: CheckView] }>()
</script>

<template>
  <section class="check-section" aria-labelledby="checks-running">
    <h2 id="checks-running" class="section-title">
      Running
      <span class="worker" :class="{ online: workerOnline }" data-worker>
        <span class="dot" aria-hidden="true" />
        {{ workerOnline ? 'Worker online' : 'Worker offline' }}
      </span>
    </h2>
    <div v-if="check" class="items">
      <div class="item">
        <CheckFinding :check="check" />
        <CheckChip :check="check" focusable />
        <span class="meta">requested by {{ check.requestedBy }}</span>
        <BaseButton
          class="push"
          :aria-label="`Cancel the running check of ${check.vulnId}`"
          @click="$emit('cancel', check)"
        >
          Cancel
        </BaseButton>
      </div>
    </div>
    <p v-else class="none">
      {{
        workerOnline
          ? 'Nothing running, the worker picks up the next queued check.'
          : 'Nothing running. Queued checks wait until the worker polls again.'
      }}
    </p>
  </section>
</template>

<style scoped src="@/components/checks/checkSection.css"></style>

<style scoped>
.worker {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-warning);
  font-weight: var(--font-weight-medium);
  letter-spacing: normal;
  text-transform: none;
}

.worker.online {
  color: var(--color-success);
}

.dot {
  width: var(--dot-size);
  height: var(--dot-size);
  border-radius: var(--radius-pill);
  background: currentColor;
}
</style>
