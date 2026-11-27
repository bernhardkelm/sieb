<script setup lang="ts">
import { computed } from 'vue'

import EmptyState from '@/components/common/EmptyState.vue'
import { AUTO_CHECK_DOCS_PATH, docsLinkOf } from '@/format/docsLink'
import { useMeStore } from '@/stores/meStore'

const me = useMeStore()
const docsLink = computed(() => docsLinkOf(me.sourceCodeUrl, AUTO_CHECK_DOCS_PATH))
</script>

<template>
  <EmptyState title="Auto-check is off" align="start">
    With Auto-check, a worker in the cluster runs headless Claude on findings of public images, one
    at a time, and Claude files a normal proposal to the Inbox. An operator switches it on with
    <code>SIEB_CHECKS_ENABLED</code> and deploys the worker.
    <template #actions>
      <a v-if="docsLink" :href="docsLink" target="_blank" rel="noopener noreferrer">
        How to set up Auto-check<span class="visually-hidden">, opens in a new tab</span>
      </a>
      <p v-else class="setup">
        The setup is described in <code>{{ AUTO_CHECK_DOCS_PATH }}</code> of the sieb repository.
      </p>
    </template>
  </EmptyState>
</template>

<style scoped>
.setup {
  color: var(--color-text-muted);
}

code {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}
</style>
