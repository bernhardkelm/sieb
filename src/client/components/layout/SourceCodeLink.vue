<script setup lang="ts">
import { useMeStore } from '@/stores/meStore'

const me = useMeStore()
</script>

<template>
  <p v-if="me.sourceCodeUrl" class="source-code-link">
    <template v-if="me.version">
      <span>sieb {{ me.version }}</span>
      <span aria-hidden="true">·</span>
    </template>
    <a class="link" :href="me.sourceCodeUrl" target="_blank" rel="noopener noreferrer">
      Source<span class="visually-hidden"> code of this version, opens in a new tab</span>
    </a>
  </p>
</template>

<style scoped>
.source-code-link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.link {
  color: inherit;
}

.link:hover {
  color: var(--color-text);
}
</style>
