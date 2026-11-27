<script setup lang="ts">
import { computed } from 'vue'

import TextField from '@/components/common/TextField.vue'
import FieldErrors from '@/components/decision/FieldErrors.vue'

const props = defineProps<{
  /** Registry host of the example, such as ghcr.io */
  registryHost: string
  /** Git host of the example, such as github.com */
  gitHost: string
  errors: string[]
}>()

const registryPrefix = defineModel<string>('registryPrefix', { required: true })
const repoPrefix = defineModel<string>('repoPrefix', { required: true })

const from = computed(() => `${props.registryHost}/your-group/`)
const to = computed(() => `${props.gitHost}/your-group/`)
const open = registryPrefix.value !== '' || repoPrefix.value !== ''
</script>

<template>
  <details class="repo-mapping" :open="open || errors.length > 0">
    <summary class="summary">Repository mapping (optional)</summary>
    <p class="hint">
      Only for images without the <code>org.opencontainers.image.source</code> label. Auto-check
      swaps the registry prefix of the image for the repository prefix to find the repository to
      clone: <code>{{ from }}</code> to <code>{{ to }}</code> maps <code>{{ from }}shop</code> to
      <code>{{ to }}shop</code>.
    </p>
    <div class="fields">
      <TextField
        v-model="registryPrefix"
        label="Registry prefix"
        :placeholder="from"
        mono
        :invalid="errors.length > 0"
      />
      <TextField
        v-model="repoPrefix"
        label="Repository prefix"
        :placeholder="to"
        mono
        :invalid="errors.length > 0"
      />
    </div>
    <FieldErrors :messages="errors" />
  </details>
</template>

<style scoped>
.repo-mapping {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.summary {
  width: fit-content;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.hint {
  margin-top: var(--space-2);
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--fact-min-width), 1fr));
  gap: var(--space-3);
  margin-top: var(--space-2);
}

code {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}
</style>
