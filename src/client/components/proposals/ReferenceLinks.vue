<script setup lang="ts">
import { computed } from 'vue'

import ExternalLink from '@/components/common/ExternalLink.vue'
import { safeReferences } from '@/components/proposals/proposalText'

const props = defineProps<{
  references: string[]
}>()

const links = computed(() => safeReferences(props.references))
</script>

<template>
  <ul v-if="links.length > 0" class="reference-links">
    <li v-for="link in links" :key="link">
      <ExternalLink :href="link">{{ link }}</ExternalLink>
    </li>
  </ul>
  <p v-else class="none">No references.</p>
</template>

<style scoped>
.reference-links {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-sm);
}

.reference-links :deep(a) {
  overflow-wrap: anywhere;
}

.none {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}
</style>
