<script setup lang="ts">
import { computed } from 'vue'

import type { CheckUsageSummary } from '#core/check.ts'
import { checkUsageRows } from '@/format/checkUsageText'

const props = defineProps<{
  summary: CheckUsageSummary
}>()

const rows = computed(() => checkUsageRows(props.summary))
</script>

<template>
  <section class="check-section" aria-labelledby="checks-usage">
    <h2 id="checks-usage" class="section-title">Usage</h2>
    <div class="usage">
      <table class="table">
        <thead>
          <tr>
            <td />
            <th scope="col">Last 7 days</th>
            <th scope="col">Last 30 days</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.label">
            <th scope="row">{{ row.label }}</th>
            <td v-for="(value, index) in row.values" :key="index">{{ value }}</td>
          </tr>
        </tbody>
      </table>
      <p class="note">
        Ended checks of all users. The cost is an API-equivalent estimate from the token counts the
        worker reports: billed as such with an API key, counted against plan limits with a
        subscription. The average duration covers done and failed checks.
      </p>
    </div>
  </section>
</template>

<style scoped src="@/components/checks/checkSection.css"></style>

<style scoped>
.usage {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.table {
  align-self: flex-start;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

th,
td {
  padding: var(--space-1) var(--space-6) var(--space-1) 0;
  text-align: left;
  vertical-align: top;
}

thead th {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

tbody th {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-regular);
}

td {
  font-variant-numeric: tabular-nums;
}

.note {
  margin: 0;
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}
</style>
