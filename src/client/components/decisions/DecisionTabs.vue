<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import type { DecisionFilter } from '#core/decisionFilter.ts'
import { DECISION_TABS } from '@/components/decisions/decisionTabs'

defineProps<{
  counts: Record<DecisionFilter, number>
}>()

const tab = defineModel<DecisionFilter>('tab', { required: true })
</script>

<template>
  <TabsRoot v-model="tab" class="decision-tabs" activation-mode="automatic">
    <TabsList class="list" aria-label="Decision states">
      <TabsTrigger
        v-for="item in DECISION_TABS"
        :key="item.value"
        class="trigger"
        :value="item.value"
      >
        {{ item.label }}
        <span
          class="count"
          :class="{ attention: item.value === 'reopened' && counts.reopened > 0 }"
        >
          {{ counts[item.value] }}
        </span>
      </TabsTrigger>
    </TabsList>
    <TabsContent class="content" :value="tab" tabindex="-1">
      <slot />
    </TabsContent>
  </TabsRoot>
</template>

<style scoped>
.list {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-0-5);
  margin: var(--space-2) var(--space-4);
  padding: var(--space-0-5);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-page);
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  height: calc(var(--control-height) - var(--space-1));
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.trigger:hover {
  color: var(--color-text);
}

.trigger[aria-selected='true'] {
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  color: var(--color-text);
}

.count {
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
}

.attention {
  color: var(--color-danger);
  font-weight: var(--font-weight-semibold);
}

.content:focus {
  outline: none;
}

@media (max-width: 639px) {
  .list {
    margin: var(--space-2) var(--space-3);
  }
}
</style>
