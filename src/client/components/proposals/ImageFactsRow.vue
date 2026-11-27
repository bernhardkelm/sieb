<script setup lang="ts">
import type { ProposalImageFacts } from '#core/apiTypes.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import DecisionStateChip from '@/components/chips/DecisionStateChip.vue'
import ExposureChip from '@/components/chips/ExposureChip.vue'
import KevChip from '@/components/chips/KevChip.vue'
import OwnerBadge from '@/components/chips/OwnerBadge.vue'
import SeverityChip from '@/components/chips/SeverityChip.vue'
import SourceAccessBadge from '@/components/chips/SourceAccessBadge.vue'
import { countOf } from '@/format/count'
import { shortImageName } from '@/format/imageName'
import { SCOPE_LABELS } from '@/format/labels'

defineProps<{
  image: ProposalImageFacts
}>()
</script>

<template>
  <li class="image-facts-row" :data-image-ref="image.imageRef">
    <div class="name-line">
      <span class="name" :title="image.imageRef">{{ shortImageName(image.imageRef) }}</span>
      <OwnerBadge v-if="image.owner" :owner="image.owner" class="owner" />
    </div>
    <p class="ref">{{ image.imageRef }}</p>
    <div class="chips">
      <SeverityChip v-if="image.severity" :severity="image.severity" :score="image.score" />
      <KevChip v-if="image.kev" />
      <ExposureChip v-if="image.exposure" :exposure="image.exposure" focusable />
      <SourceAccessBadge :access="image.sourceAccess" />
      <BaseChip v-if="!image.open" outline>resolved</BaseChip>
    </div>
    <dl class="facts">
      <div class="versions">
        <dt>Installed → fixed</dt>
        <dd>
          <span v-for="(version, index) in image.versions" :key="index" class="version">
            <span v-if="version.package" class="package">{{ version.package }}</span>
            {{ version.installedVersion }} →
            <span :class="{ missing: version.fixedVersion === null }">{{
              version.fixedVersion ?? 'no fix'
            }}</span>
          </span>
          <span v-if="image.versions.length === 0" class="missing">no current instance</span>
        </dd>
      </div>
      <div>
        <dt>Workloads</dt>
        <dd :title="image.workloads.join('\n') || undefined">
          {{ countOf(image.workloads.length, 'workload') }}
        </dd>
      </div>
      <div>
        <dt>Current decision</dt>
        <dd class="decision">
          <template v-if="image.decision">
            <DecisionStateChip
              :effective="image.decision.effective"
              :status="image.decision.decision.status"
              :justification="image.decision.decision.justification"
            />
            <span v-if="image.decision.decision.scope === 'all'" class="scope">{{
              SCOPE_LABELS.all
            }}</span>
          </template>
          <span v-else class="missing">Undecided</span>
        </dd>
      </div>
    </dl>
  </li>
</template>

<style scoped>
.image-facts-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
  padding: var(--space-2) var(--space-3);
}

.name-line {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
}

.name {
  min-width: 0;
  overflow: hidden;
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owner {
  flex: none;
}

.ref,
.package {
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1-5);
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--space-base) * 28), 1fr));
  gap: var(--space-2) var(--space-4);
  margin: 0;
  font-size: var(--font-size-sm);
}

.facts dt {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

.facts dd {
  margin: 0;
}

.versions {
  grid-column: 1 / -1;
}

.version {
  display: block;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.package {
  margin-right: var(--space-1);
}

.decision {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1-5);
}

.scope,
.missing {
  color: var(--color-text-subtle);
}
</style>
