<script setup lang="ts">
import { computed } from 'vue'

import { proposalClientLabel, type ProposalClientFields } from '@/format/proposalClientLabel'

const props = defineProps<{
  client: ProposalClientFields
}>()

const label = computed(() => proposalClientLabel(props.client))
</script>

<template>
  <span class="proposal-client-tag" :title="`Proposed via ${label}`">{{ label }}</span>
</template>

<style scoped>
.proposal-client-tag {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
