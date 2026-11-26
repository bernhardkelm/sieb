<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { StatPanelModel } from '@/components/overview/statPanels'
import StatSparkline from '@/components/overview/StatSparkline.vue'

const props = defineProps<{
  panel: StatPanelModel
  /** Appended to the delta, such as "30d", empty to leave it out */
  rangeSuffix: string
}>()

const emit = defineEmits<{ open: [panel: StatPanelModel] }>()

const target = computed(() => props.panel.target)
const linkAttrs = computed(() =>
  target.value
    ? {
        to: { name: target.value.route, query: target.value.query },
        title: target.value.hint,
        onClick: () => emit('open', props.panel),
      }
    : {},
)
const delta = computed(() =>
  props.panel.deltaText !== null && props.rangeSuffix !== ''
    ? `${props.panel.deltaText} / ${props.rangeSuffix}`
    : props.panel.deltaText,
)
</script>

<template>
  <component
    :is="target ? RouterLink : 'div'"
    class="stat-panel"
    :class="{ link: target, secondary: !panel.primary }"
    v-bind="linkAttrs"
  >
    <span class="label">{{ panel.label }}</span>
    <span class="figures">
      <span class="value">{{ panel.valueText }}</span>
      <span v-if="delta" class="delta" :class="panel.tone" aria-hidden="true">{{ delta }}</span>
    </span>
    <StatSparkline
      v-if="panel.trendLabel && panel.trendTitle"
      :points="panel.points"
      :label="panel.trendLabel"
      :title="panel.trendTitle"
    />
  </component>
</template>

<style scoped>
.stat-panel {
  --stat-surface: var(--color-stat-surface);

  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  min-width: 0;
  padding: var(--space-1-5) var(--space-2);
  border-radius: var(--radius);
  background: var(--stat-surface);
  color: var(--color-text);
  text-decoration: none;
}

.link:hover {
  --stat-surface: var(--color-stat-surface-hover);
}

.label {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figures {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1);
  min-width: 0;
}

.value {
  font-size: var(--stat-value-size, var(--font-size-md));
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  line-height: var(--line-height-tight);
}

.delta {
  overflow: hidden;
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delta.good {
  color: var(--color-success);
}

.delta.bad {
  color: var(--color-danger);
}
</style>
