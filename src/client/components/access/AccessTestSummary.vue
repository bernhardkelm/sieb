<script setup lang="ts">
import type { AccessTestResult } from '#core/privateAccess.ts'
import AccessTestParts from '@/components/access/AccessTestParts.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import { UNTESTED_NOTE } from '@/format/accessTestText'

defineProps<{
  /** Last test, null before the first one */
  result: AccessTestResult | null
  /** Whether a test runs right now */
  testing: boolean
}>()
</script>

<template>
  <div class="access-test-summary" role="status" aria-live="polite">
    <p v-if="testing" class="testing">
      <LoadingSpinner />
      Testing access to the covered images and repositories…
    </p>
    <template v-else-if="result">
      <p class="when">Last test <RelativeTime :value="result.at" /></p>
      <p v-if="result.untested" class="untested">{{ UNTESTED_NOTE }}</p>
      <AccessTestParts :result="result" />
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

.untested {
  color: var(--color-warning);
}
</style>
