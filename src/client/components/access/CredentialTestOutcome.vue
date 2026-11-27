<script setup lang="ts">
import { computed } from 'vue'

import type { AccessTestVerdict } from '#core/accessTestVerdict.ts'
import type { AccessTestResult } from '#core/privateAccess.ts'
import AccessTestParts from '@/components/access/AccessTestParts.vue'
import CalloutBox from '@/components/common/CalloutBox.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { CredentialTestPhase } from '@/composables/useCredentialTest'
import { testOutcomeText, testProgressText, UNTESTED_CONFIRM_LABEL } from '@/format/accessTestText'

const props = defineProps<{
  /** Last test of the form's values, null before one ran */
  result: AccessTestResult | null
  verdict: AccessTestVerdict | null
  /** Whether the result is that of a refused save */
  refused: boolean
  /** Test running right now, null while idle */
  running: CredentialTestPhase | null
}>()

const confirmUntested = defineModel<boolean>('confirmUntested', { required: true })

const TONES: Record<AccessTestVerdict, 'info' | 'warning' | 'danger'> = {
  passed: 'info',
  test_failed: 'danger',
  nothing_to_test: 'warning',
  untestable: 'warning',
}

const headline = computed(() => {
  if (props.running !== null) {
    return testProgressText(props.running)
  }

  return props.verdict === null ? '' : testOutcomeText(props.verdict, props.refused)
})
const shown = computed(() => props.running === null && props.result !== null)
</script>

<template>
  <div class="credential-test-outcome">
    <p
      class="headline"
      :class="shown && verdict ? TONES[verdict] : 'progress'"
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner v-if="running" />
      {{ headline }}
    </p>
    <CalloutBox v-if="shown && result && verdict" class="details" :tone="TONES[verdict]">
      <AccessTestParts :result="result" />
      <label v-if="verdict === 'untestable'" class="check">
        <input v-model="confirmUntested" type="checkbox" name="confirmUntested" />
        {{ UNTESTED_CONFIRM_LABEL }}
      </label>
    </CalloutBox>
  </div>
</template>

<style scoped>
.credential-test-outcome {
  display: flex;
  flex-direction: column;
}

.details {
  margin-top: var(--space-1-5);
}

.headline {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.progress {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-regular);
}

.info {
  color: var(--color-success);
}

.warning {
  color: var(--color-warning);
}

.danger {
  color: var(--color-danger);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.check input {
  margin: 0;
  accent-color: var(--color-accent);
}
</style>
