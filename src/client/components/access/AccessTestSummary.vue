<script setup lang="ts">
import { computed } from 'vue'

import type { AccessTestResult } from '#core/privateAccess.ts'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import { testFailureText, testPartText } from '@/format/accessText'

const props = defineProps<{
  /** Last test, null before the first one */
  result: AccessTestResult | null
  /** Whether a test runs right now */
  testing: boolean
}>()

const parts = computed(() => {
  const result = props.result

  if (result === null) {
    return []
  }

  return [
    result.registry === null ? null : { name: 'Images', part: result.registry },
    result.git === null ? null : { name: 'Repositories', part: result.git },
  ].filter((entry) => entry !== null)
})
</script>

<template>
  <div class="access-test-summary" role="status" aria-live="polite">
    <p v-if="testing" class="testing">
      <LoadingSpinner />
      Testing access to the covered images and repositories…
    </p>
    <template v-else-if="result">
      <p class="when">Last test <RelativeTime :value="result.at" /></p>
      <ul class="parts">
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
    <p v-else class="when">Not tested yet.</p>
  </div>
</template>

<style scoped>
.access-test-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
}

.testing {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  color: var(--color-text-muted);
}

.when {
  color: var(--color-text-subtle);
}

.parts,
.failures {
  margin: 0;
  padding: 0;
  list-style: none;
}

.parts > li {
  color: var(--color-success);
}

.parts > li.idle {
  color: var(--color-text-muted);
}

.parts > li.failed {
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
