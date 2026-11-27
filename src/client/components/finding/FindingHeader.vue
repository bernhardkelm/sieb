<script setup lang="ts">
import { computed } from 'vue'

import type { FindingView } from '#core/findingView.ts'
import type { ImageAccess } from '#core/imageVisibility.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import ExposureChip from '@/components/chips/ExposureChip.vue'
import ImageAccessChips from '@/components/chips/ImageAccessChips.vue'
import KevChip from '@/components/chips/KevChip.vue'
import OwnerBadge from '@/components/chips/OwnerBadge.vue'
import SeverityChip from '@/components/chips/SeverityChip.vue'
import ExternalLink from '@/components/common/ExternalLink.vue'
import FactItem from '@/components/common/FactItem.vue'
import FactList from '@/components/common/FactList.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import ExposureMeaning from '@/components/finding/ExposureMeaning.vue'
import { vulnLinks } from '#core/vulnLinks.ts'
import { useLabelsStore } from '@/stores/labelsStore'

const props = withDefaults(
  defineProps<{
    finding: FindingView
    /** Visibility and ownership of the image, null hides their chips */
    access?: ImageAccess | null
  }>(),
  { access: null },
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
      <ImageAccessChips v-if="access" :access="access" />
      <span class="score">{{ finding.score === null ? 'no score' : `CVSS ${finding.score}` }}</span>
      <BaseChip v-if="finding.resolvedAt !== null" variant="outline">resolved</BaseChip>
    </div>
    <ExposureMeaning v-if="labels.showExposure" :exposure="finding.exposure" />
    <p class="image mono">{{ finding.imageRef }}</p>
    <FactList>
      <FactItem label="First seen"><RelativeTime :value="finding.firstSeen" /></FactItem>
      <FactItem label="Last seen"><RelativeTime :value="finding.lastSeen" /></FactItem>
      <FactItem v-if="finding.resolvedAt !== null" label="Resolved">
        <RelativeTime :value="finding.resolvedAt" />
      </FactItem>
    </FactList>
    <ul v-if="links.length > 0" class="links">
      <li v-for="link in links" :key="link.href">
        <ExternalLink :href="link.href">{{ link.label }}</ExternalLink>
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
