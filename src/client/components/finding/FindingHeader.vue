<script setup lang="ts">
import { computed } from 'vue'

import type { FindingView } from '#core/findingView.ts'
import type { SourceAccess } from '#core/sourceAccess.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import ExposureChip from '@/components/chips/ExposureChip.vue'
import KevChip from '@/components/chips/KevChip.vue'
import OwnerBadge from '@/components/chips/OwnerBadge.vue'
import SeverityChip from '@/components/chips/SeverityChip.vue'
import SourceAccessBadge from '@/components/chips/SourceAccessBadge.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import { vulnLinks } from '#core/vulnLinks.ts'
import { useLabelsStore } from '@/stores/labelsStore'

const props = withDefaults(
  defineProps<{
    finding: FindingView
    /** What Claude can check of the image source, null hides the badge */
    sourceAccess?: SourceAccess | null
  }>(),
  { sourceAccess: null },
)

const labels = useLabelsStore()
const links = computed(() =>
  vulnLinks({ ...props.finding, kev: labels.showKev && props.finding.kev }),
)
</script>

<template>
  <div class="finding-header">
    <p class="title">{{ finding.title ?? 'No title from the scanner' }}</p>
    <div class="chips">
      <SeverityChip
        :severity="finding.severity"
        :source="finding.severitySource"
        :score="finding.score"
      />
      <KevChip v-if="labels.showKev && finding.kev" />
      <ExposureChip v-if="labels.showExposure && finding.exposure" :exposure="finding.exposure" />
      <OwnerBadge v-if="labels.showOwner && finding.owner" :owner="finding.owner" />
      <SourceAccessBadge v-if="sourceAccess" :access="sourceAccess" />
      <span class="score">{{ finding.score === null ? 'no score' : `CVSS ${finding.score}` }}</span>
      <BaseChip v-if="finding.resolvedAt !== null" outline>resolved</BaseChip>
    </div>
    <p class="image mono">{{ finding.imageRef }}</p>
    <dl class="times">
      <div>
        <dt>First seen</dt>
        <dd><RelativeTime :value="finding.firstSeen" /></dd>
      </div>
      <div>
        <dt>Last seen</dt>
        <dd><RelativeTime :value="finding.lastSeen" /></dd>
      </div>
      <div v-if="finding.resolvedAt !== null">
        <dt>Resolved</dt>
        <dd><RelativeTime :value="finding.resolvedAt" /></dd>
      </div>
    </dl>
    <ul v-if="links.length > 0" class="links">
      <li v-for="link in links" :key="link.href">
        <a :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }} ↗</a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.finding-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1-5);
}

.score {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.image {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

.mono {
  font-family: var(--font-mono);
}

.times {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin: 0;
  font-size: var(--font-size-sm);
}

.times dt {
  color: var(--color-text-subtle);
}

.times dd {
  margin: 0;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-sm);
}
</style>
