<script setup lang="ts">
import { useLabelsStore } from '@/stores/labelsStore'

const reconfirm = defineModel<boolean>({ required: true })

const labels = useLabelsStore()
</script>

<template>
  <div class="reconfirm-field">
    <label class="check">
      <input v-model="reconfirm" type="checkbox" name="reconfirm" />
      Re-confirm at the current severity{{ labels.showKev ? ' and KEV listing' : '' }}
    </label>
    <p class="note" :class="{ kept: !reconfirm }">
      {{
        reconfirm
          ? 'Saving puts the decision back in effect and records the current findings as its baseline.'
          : 'Saving without re-confirming keeps the decision re-opened; its findings stay in Triage.'
      }}
    </p>
  </div>
</template>

<style scoped>
.reconfirm-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  font-weight: var(--font-weight-medium);
}

.check input {
  margin: 0;
  accent-color: var(--color-accent);
}

.note {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}

.kept {
  color: var(--color-warning);
}
</style>
