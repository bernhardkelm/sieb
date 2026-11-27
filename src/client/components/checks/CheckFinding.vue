<script setup lang="ts">
import { RouterLink } from 'vue-router'

import type { CheckView } from '#core/check.ts'
import ImageName from '@/components/common/ImageName.vue'
import { FINDING_QUERY, ROUTE_NAMES } from '@/router/routeNames'

defineProps<{
  check: CheckView
}>()
</script>

<template>
  <span class="check-finding">
    <RouterLink
      class="vuln-id"
      :to="{ name: ROUTE_NAMES.CHECKS, query: { [FINDING_QUERY]: String(check.findingId) } }"
    >
      {{ check.vulnId }}
    </RouterLink>
    <span class="image"><ImageName :image-ref="check.imageRef" /></span>
  </span>
</template>

<style scoped>
.check-finding {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-2);
  min-width: 0;
}

.vuln-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.image {
  min-width: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
