<script setup lang="ts">
import { computed } from 'vue'

import type { AccessTestResult } from '#core/privateAccess.ts'
import { testFailureText, testPartText } from '@/format/accessText'

const props = defineProps<{
  result: AccessTestResult
}>()

const parts = computed(() =>
  [
    props.result.registry === null ? null : { name: 'Images', part: props.result.registry },
    props.result.git === null ? null : { name: 'Repositories', part: props.result.git },
  ].filter((entry) => entry !== null),
)
</script>

<template>
  <ul class="access-test-parts">
    <li
      v-for="entry in parts"
      :key="entry.name"
      :class="{ failed: entry.part.ok < entry.part.checked, idle: entry.part.checked === 0 }"
    >
      {{ entry.name }}: {{ testPartText(entry.part) }}
      <ul v-if="entry.part.failures.length > 0" class="failures">
        <li v-for="failure in entry.part.failures" :key="failure.target">
          <code>{{ failure.target }}</code>: {{ testFailureText(failure.reason) }}
        </li>
      </ul>
    </li>
  </ul>
</template>

<style scoped>
.access-test-parts,
.failures {
  margin: 0;
  padding: 0;
  list-style: none;
}

.access-test-parts > li {
  color: var(--color-success);
}

.access-test-parts > li.idle {
  color: var(--color-text-muted);
}

.access-test-parts > li.failed {
  color: var(--color-danger);
}

.failures {
  margin-top: var(--space-0-5);
  padding-left: var(--space-3);
  color: var(--color-text-muted);
}

code {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}
</style>
