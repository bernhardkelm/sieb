<script setup lang="ts">
import type { SourceAccess } from '#core/sourceAccess.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { SOURCE_ACCESS_HINTS, SOURCE_ACCESS_LABELS } from '@/format/proposalLabels'

defineProps<{
  access: SourceAccess
}>()
</script>

<template>
  <HintTooltip :text="SOURCE_ACCESS_HINTS[access]">
    <BaseChip variant="outline" class="source-access-badge" :data-access="access" focusable>
      <AppIcon v-if="access === 'private'" name="lock" class="lock" />
      {{ SOURCE_ACCESS_LABELS[access] }}
    </BaseChip>
  </HintTooltip>
</template>

<style scoped>
.lock {
  --icon-size: var(--chip-icon-size);
}
</style>
