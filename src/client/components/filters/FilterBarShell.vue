<script setup lang="ts">
import { ref } from 'vue'

import SearchInput from '@/components/filters/SearchInput.vue'

defineProps<{
  placeholder: string
  /** Accessible name of the search input, the placeholder when omitted */
  label?: string
}>()

const q = defineModel<string>('q', { required: true })

const search = ref<InstanceType<typeof SearchInput> | null>(null)

/**
 * Focuses the search input.
 * @returns {void}
 */
const focusSearch = (): void => {
  search.value?.focus()
}

defineExpose({ focusSearch })
</script>

<template>
  <div class="filter-bar" role="search">
    <SearchInput ref="search" v-model="q" :label="label" :placeholder="placeholder" />
    <div class="controls scroll-row">
      <slot />
    </div>
  </div>
</template>

<style scoped src="@/components/layout/scrollRow.css"></style>

<style scoped>
.filter-bar {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.controls {
  flex: 1 1 0;
}

@media (max-width: 639px) {
  .filter-bar,
  .controls {
    flex: 1 1 100%;
  }
}
</style>
