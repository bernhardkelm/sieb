<script setup lang="ts">
import { computed } from 'vue'

import type { KevDetails } from '#core/kev.ts'
import { formatDay } from '@/format/relativeTime'

const props = defineProps<{
  details: KevDetails
}>()

const ransomware = computed(() => {
  if (props.details.knownRansomware === null) {
    return 'Not stated'
  }

  return props.details.knownRansomware ? 'Known' : 'Unknown'
})
</script>

<template>
  <div class="kev-details">
    <p v-if="details.vulnerabilityName" class="name">{{ details.vulnerabilityName }}</p>
    <p v-if="details.shortDescription" class="description">{{ details.shortDescription }}</p>
    <dl class="facts">
      <div>
        <dt>Added</dt>
        <dd>{{ formatDay(details.dateAdded) }}</dd>
      </div>
      <div v-if="details.dueDate">
        <dt>Due</dt>
        <dd>{{ formatDay(details.dueDate) }}</dd>
      </div>
      <div>
        <dt>Ransomware use</dt>
        <dd :class="{ known: details.knownRansomware === true }">{{ ransomware }}</dd>
      </div>
    </dl>
    <div v-if="details.requiredAction" class="action">
      <span class="label">Required action</span>
      <p>{{ details.requiredAction }}</p>
    </div>
  </div>
</template>

<style scoped>
.kev-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.name {
  font-weight: var(--font-weight-medium);
  overflow-wrap: anywhere;
}

.description {
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin: 0;
}

.facts dt,
.label {
  color: var(--color-text-subtle);
}

.facts dd {
  margin: 0;
}

.known {
  color: var(--color-kev);
}

.action {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}
</style>
