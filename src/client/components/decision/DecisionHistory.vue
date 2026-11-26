<script setup lang="ts">
import { computed } from 'vue'

import type { DecisionEvent } from '#core/decisionEvent.ts'
import type { DecisionView } from '#core/findingView.ts'
import RelativeTime from '@/components/common/RelativeTime.vue'
import { describeEvent } from '@/components/decision/decisionEvents'
import { SCOPE_LABELS } from '@/format/labels'

const props = defineProps<{
  /** Events oldest first, as the API answers them */
  events: DecisionEvent[]
  decisions: DecisionView[]
}>()

const entries = computed(() => {
  const scopes = new Map(props.decisions.map((view) => [view.decision.id, view.decision.scope]))

  return [...props.events].reverse().map((event) => {
    const scope = scopes.get(event.decisionId)

    return {
      event,
      summary: describeEvent(event),
      scope: scope ? SCOPE_LABELS[scope] : null,
    }
  })
})
</script>

<template>
  <ol v-if="entries.length > 0" class="decision-history">
    <li v-for="{ event, summary, scope } in entries" :key="event.id" class="entry">
      <div class="head">
        <span class="title">{{ summary.title }}</span>
        <span v-if="scope" class="scope">{{ scope }}</span>
        <span class="meta"> {{ event.actor }} · <RelativeTime :value="event.at" /> </span>
      </div>
      <p v-for="(line, index) in summary.lines" :key="index" class="line">{{ line }}</p>
    </li>
  </ol>
  <p v-else class="empty">No decisions yet.</p>
</template>

<style scoped>
.decision-history {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0 0 0 var(--space-3);
  border-left: var(--border-width) solid var(--color-border);
  list-style: none;
}

.entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
}

.title {
  font-weight: var(--font-weight-medium);
}

.scope,
.meta {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}

.meta {
  margin-left: auto;
}

.line {
  color: var(--color-text-muted);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.empty {
  color: var(--color-text-subtle);
}
</style>
