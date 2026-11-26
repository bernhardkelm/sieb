<script setup lang="ts">
import { computed, onMounted, useId } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import RangeSwitcher from '@/components/overview/RangeSwitcher.vue'
import SeverityMixBar from '@/components/overview/SeverityMixBar.vue'
import StatPanel from '@/components/overview/StatPanel.vue'
import { buildStatPanels, type StatPanelModel } from '@/components/overview/statPanels'
import { useFindingsStore } from '@/stores/findingsStore'
import { useLabelsStore } from '@/stores/labelsStore'
import { useStatsStore } from '@/stores/statsStore'

const props = withDefaults(
  defineProps<{
    /** Compact in the sidebar, larger with inline legend in the mobile sheet */
    variant?: 'sidebar' | 'sheet'
  }>(),
  { variant: 'sidebar' },
)

const emit = defineEmits<{ navigate: [] }>()

const stats = useStatsStore()
const findings = useFindingsStore()
const labels = useLabelsStore()
const titleId = useId()

const panels = computed(() =>
  stats.data
    ? buildStatPanels(stats.data, stats.fetchedAt, stats.range, {
        exposure: labels.showExposure,
        kev: labels.showKev,
      })
    : [],
)
const hasHistory = computed(() => (stats.data?.series.length ?? 0) > 0)
const rangeSuffix = computed(() => (props.variant === 'sheet' ? stats.range : ''))

/**
 * Applies the finding filters of a clicked panel before its link navigates.
 * @param {StatPanelModel} panel - Clicked panel
 * @returns {void}
 */
const onOpen = (panel: StatPanelModel): void => {
  const filters = panel.target?.filters

  if (filters) {
    findings.resetFilters()
    findings.setFilters(filters)
  }

  emit('navigate')
}

onMounted(() => {
  void stats.ensureLoaded()
})
</script>

<template>
  <section class="overview" :class="`variant-${variant}`" :aria-labelledby="titleId">
    <header class="header">
      <h2 :id="titleId" class="title">Overview</h2>
      <div class="tools">
        <RangeSwitcher :range="stats.range" @select="stats.setRange" />
        <slot name="actions" />
      </div>
    </header>
    <p v-if="!stats.data && !stats.error" class="state" role="status">Loading stats…</p>
    <div v-else-if="!stats.data" class="state" role="alert">
      <span>Stats unavailable</span>
      <BaseButton variant="ghost" @click="stats.refresh()">Retry</BaseButton>
    </div>
    <template v-else>
      <div class="grid">
        <StatPanel
          v-for="panel in panels"
          :key="panel.key"
          :panel="panel"
          :range-suffix="rangeSuffix"
          @open="onOpen"
        />
      </div>
      <SeverityMixBar
        :counts="stats.data.current.bySeverity"
        :inline-legend="variant === 'sheet'"
      />
      <p v-if="!hasHistory" class="state">No history yet, trends start with the next sync.</p>
      <p v-if="stats.error" class="state" role="status" :title="stats.error">
        Update failed, showing the last stats.
      </p>
    </template>
  </section>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-left: var(--space-2);
}

.tools {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.title {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--stat-gap);
}

.state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

.variant-sidebar .severity-mix {
  padding: 0 var(--space-2);
}

.variant-sheet {
  --stat-value-size: var(--font-size-xl);
  --sparkline-height: var(--sparkline-height-lg);
  --range-item-size: var(--touch-target);
  --color-stat-surface: var(--color-page);
  --color-stat-surface-hover: var(--color-sidebar);

  gap: var(--space-3);
}

.variant-sheet .grid {
  gap: var(--stat-gap-lg);
}

.variant-sheet .grid > * {
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-3);
}

.variant-sheet .header,
.variant-sheet .state {
  padding-left: 0;
}

.variant-sheet .title {
  font-size: var(--font-size-sm);
}

/* short viewport: the last panel row goes first, then the hints (AppSidebar) */
@media (max-height: 759px) {
  .variant-sidebar .grid > .secondary {
    display: none;
  }
}
</style>
