<script setup lang="ts">
import { computed } from 'vue'

import type { KevDetails } from '#core/kev.ts'
import FactItem from '@/components/common/FactItem.vue'
import FactList from '@/components/common/FactList.vue'
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
    <FactList>
      <FactItem label="Added">{{ formatDay(details.dateAdded) }}</FactItem>
      <FactItem v-if="details.dueDate" label="Due">{{ formatDay(details.dueDate) }}</FactItem>
      <FactItem label="Ransomware use">
        <span :class="{ known: details.knownRansomware === true }">{{ ransomware }}</span>
      </FactItem>
    </FactList>
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

.label {
  color: var(--color-text-subtle);
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
