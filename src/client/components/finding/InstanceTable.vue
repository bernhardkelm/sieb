<script setup lang="ts">
import { computed } from 'vue'

import { groupBy } from '#core/groupBy.ts'
import type { FindingInstance } from '#core/instance.ts'
import BaseChip from '@/components/chips/BaseChip.vue'

const props = defineProps<{
  instances: FindingInstance[]
}>()

const groups = computed(() =>
  [
    ...groupBy(
      props.instances,
      (instance) => `${instance.namespace}/${instance.resourceKind}/${instance.resourceName}`,
    ),
  ].map(([workload, instances]) => ({ workload, instances })),
)
</script>

<template>
  <div class="instance-table" tabindex="0" role="region" aria-label="Instances">
    <table class="table">
      <thead>
        <tr>
          <th scope="col">Container</th>
          <th scope="col">Tag</th>
          <th scope="col">Package</th>
          <th scope="col">Installed → fixed</th>
        </tr>
      </thead>
      <tbody v-for="group in groups" :key="group.workload">
        <tr class="workload">
          <th scope="colgroup" colspan="4">{{ group.workload }}</th>
        </tr>
        <tr
          v-for="instance in group.instances"
          :key="instance.id"
          :class="{ resolved: instance.resolvedAt !== null }"
        >
          <td>{{ instance.container ?? '-' }}</td>
          <td class="mono">{{ instance.imageTag ?? '-' }}</td>
          <td class="mono">{{ instance.package ?? '-' }}</td>
          <td class="mono">
            {{ instance.installedVersion ?? '?' }} → {{ instance.fixedVersion ?? '?' }}
            <BaseChip v-if="instance.resolvedAt !== null" variant="outline">resolved</BaseChip>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.instance-table {
  container-type: inline-size;
  overflow-x: auto;
}

.instance-table:focus-visible {
  outline-offset: calc(-1 * var(--border-width-strong));
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

@container (max-width: 440px) {
  .table {
    min-width: calc(var(--space-base) * 120);
  }
}

th,
td {
  padding: var(--space-1) var(--space-2) var(--space-1) 0;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

thead th {
  color: var(--color-text-subtle);
  font-weight: var(--font-weight-medium);
}

.workload th {
  padding-top: var(--space-2);
  border-top: var(--border-width) solid var(--color-border);
  font-family: var(--font-mono);
  font-weight: var(--font-weight-medium);
}

.mono {
  font-family: var(--font-mono);
}

.resolved td {
  color: var(--color-text-subtle);
}
</style>
