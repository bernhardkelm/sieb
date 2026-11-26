<script setup lang="ts">
import type { CveAggregate } from '#core/cveAggregation.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import KeyHint from '@/components/common/KeyHint.vue'
import { countOf } from '@/format/count'

defineProps<{
  cve: CveAggregate
}>()

defineEmits<{ bulk: []; decideAll: [] }>()
</script>

<template>
  <div class="cve-actions">
    <span class="note">
      {{ cve.openCount }} open in {{ countOf(cve.imageCount, 'image') }}, {{ cve.inboxCount }}
      undecided
    </span>
    <BaseButton :disabled="cve.inboxCount === 0" aria-keyshortcuts="Shift+A" @click="$emit('bulk')">
      Decide open images <KeyHint decorative :keys="['⇧', 'A']" />
    </BaseButton>
    <BaseButton aria-keyshortcuts="Shift+D" @click="$emit('decideAll')">
      {{
        cve.allScopeDecision
          ? 'Edit decision for all images'
          : 'Decide for all images (incl. future)'
      }}
      <KeyHint decorative :keys="['⇧', 'D']" />
    </BaseButton>
  </div>
</template>

<style scoped>
.cve-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.note {
  margin-right: auto;
}
</style>
