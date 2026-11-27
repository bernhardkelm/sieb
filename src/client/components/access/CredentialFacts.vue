<script setup lang="ts">
import type { AccessCredentialView } from '#core/privateAccess.ts'
import FactItem from '@/components/common/FactItem.vue'
import FactList from '@/components/common/FactList.vue'
import { coveredTargets, providerLabel, usesText } from '@/format/accessText'

defineProps<{
  credential: AccessCredentialView
}>()
</script>

<template>
  <FactList>
    <FactItem label="Provider">{{ providerLabel(credential) }}</FactItem>
    <FactItem label="Used for">{{ usesText(credential.uses) }}</FactItem>
    <FactItem label="Covers">
      <span v-for="target in coveredTargets(credential)" :key="target" class="target">
        {{ target }}
      </span>
    </FactItem>
  </FactList>
</template>

<style scoped>
.target {
  display: block;
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}
</style>
