<script setup lang="ts">
import { computed } from 'vue'

import { AUTO_CHECK_DOCS_PATH, docsLinkOf } from '@/format/docsLink'
import { useMeStore } from '@/stores/meStore'

const me = useMeStore()
const docsLink = computed(() => docsLinkOf(me.sourceCodeUrl, AUTO_CHECK_DOCS_PATH))
</script>

<template>
  <div class="checks-disabled">
    <p class="title">Auto-check is off</p>
    <p class="text">
      With Auto-check, a worker in the cluster runs headless Claude on findings of public images,
      one at a time, and Claude files a normal proposal to the Inbox. An operator switches it on
      with <code>SIEB_CHECKS_ENABLED</code> and deploys the worker.
    </p>
    <p class="text">
      <a v-if="docsLink" :href="docsLink" target="_blank" rel="noopener noreferrer">
        How to set up Auto-check<span class="visually-hidden">, opens in a new tab</span>
      </a>
      <template v-else>
        The setup is described in <code>{{ AUTO_CHECK_DOCS_PATH }}</code> of the sieb repository.
      </template>
    </p>
  </div>
</template>

<style scoped>
.checks-disabled {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: calc(var(--space-base) * 150);
  padding: var(--space-12) var(--space-4);
}

.title {
  font-weight: var(--font-weight-medium);
}

.text {
  color: var(--color-text-muted);
}

code {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}
</style>
