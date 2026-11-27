<script setup lang="ts">
import { RouterLink } from 'vue-router'

import type { ImageCheckAccess } from '#core/privateAccess.ts'
import FactItem from '@/components/common/FactItem.vue'
import FactList from '@/components/common/FactList.vue'
import { checkAccessText } from '@/format/accessText'
import { ROUTE_NAMES } from '@/router/routeNames'

defineProps<{
  /** Access per image of the finding, primary first */
  access: ImageCheckAccess[]
}>()
</script>

<template>
  <FactList class="check-access-fact">
    <FactItem label="Auto-check access">
      <ul class="images">
        <li v-for="image in access" :key="image.imageRef" :class="image.level">
          <span v-if="access.length > 1" class="ref">{{ image.imageRef }}: </span>
          {{ checkAccessText(image) }}
          <template v-if="image.level === 'none'">
            ·
            <RouterLink :to="{ name: ROUTE_NAMES.ACCESS }">
              Add a credential<span class="visually-hidden"> for {{ image.imageRef }}</span>
            </RouterLink>
          </template>
        </li>
      </ul>
    </FactItem>
  </FactList>
</template>

<style scoped>
.images {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ref {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

.none {
  color: var(--color-text-muted);
}
</style>
