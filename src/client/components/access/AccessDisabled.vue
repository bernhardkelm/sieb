<script setup lang="ts">
import { computed } from 'vue'

import EmptyState from '@/components/common/EmptyState.vue'
import ExternalLink from '@/components/common/ExternalLink.vue'
import { ACCESS_DOCS_PATH } from '@/format/accessDocs'
import { AUTO_CHECK_DOCS_PATH, docsLinkOf } from '@/format/docsLink'
import { useMeStore } from '@/stores/meStore'

const me = useMeStore()
const docsLink = computed(() => docsLinkOf(me.sourceCodeUrl, ACCESS_DOCS_PATH))
</script>

<template>
  <EmptyState title="Credentials are off" align="start">
    sieb stores registry and git credentials encrypted, so it needs a key first. An operator sets
    <code>SIEB_CREDENTIALS_KEY</code> on the sieb server to 32 random bytes in base64, such as the
    output of <code>openssl rand -base64 32</code>, and <code>SIEB_FETCHER_SECRET</code> on sieb and
    the Auto-check worker, so the fetcher may pull private images and clone source.
    <template #actions>
      <ExternalLink v-if="docsLink" :href="docsLink">How to set up private access</ExternalLink>
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
