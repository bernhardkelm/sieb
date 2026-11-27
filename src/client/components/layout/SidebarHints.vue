<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import BlockableButton from '@/components/common/BlockableButton.vue'
import KeyHint from '@/components/common/KeyHint.vue'
import { useFeatures } from '@/composables/useFeatures'
import { hintView } from '@/keyboard/hintView'
import { hintsForRoute } from '@/keyboard/keyboardHints'
import { useHintActionsStore } from '@/stores/hintActionsStore'

const route = useRoute()
const actions = useHintActionsStore()
const features = useFeatures()

const hints = computed(() =>
  hintsForRoute(route.name, features.value).map((hint) =>
    hint.action
      ? hintView(hint, actions.reasonOf(hint.action), actions.bulkOf(hint.action))
      : hintView(hint, null, null),
  ),
)
</script>

<template>
  <ul class="hints" aria-label="Keyboard shortcuts">
    <li v-for="view in hints" :key="view.hint.label">
      <BlockableButton
        v-if="view.hint.action"
        class="hint action"
        :blocked-by="view.blockedBy"
        blocked-title="Not available"
        :hint="view.title"
        @press="actions.run(view.hint.action)"
      >
        <KeyHint :keys="view.hint.keys" />
        <span v-if="view.ariaLabel" class="visually-hidden">{{ view.ariaLabel }}</span>
        <span :aria-hidden="view.ariaLabel ? 'true' : undefined">{{ view.text }}</span>
      </BlockableButton>
      <span v-else class="hint">
        <KeyHint :keys="view.hint.keys" />
        <span>{{ view.text }}</span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.hints {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  margin: 0;
  padding: 0;
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
  list-style: none;
}

.hint {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-0-5) var(--space-2);
  border-radius: var(--radius);
}

.action {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
  text-align: left;
  transition:
    background-color var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.action:hover:not([aria-disabled='true']) {
  background: var(--color-hover);
  color: var(--color-text);
}

.action[aria-disabled='true'] {
  cursor: default;
  opacity: var(--opacity-disabled);
}

@media (hover: none) and (pointer: coarse) {
  .hints {
    display: none;
  }
}

/* very short viewport: hints go after the secondary overview panels (OverviewStats) */
@media (max-height: 619px) {
  .hints {
    display: none;
  }
}
</style>
