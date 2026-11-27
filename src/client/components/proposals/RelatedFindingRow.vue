<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import type { ProposalRelatedFacts } from '#core/apiTypes.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import DecisionStateChip from '@/components/chips/DecisionStateChip.vue'
import ImageName from '@/components/common/ImageName.vue'
import { withQueryParam } from '@/router/queryParam'
import { FINDING_QUERY } from '@/router/routeNames'

const props = defineProps<{
  facts: ProposalRelatedFacts
}>()

const route = useRoute()

const findingLink = computed(() => ({
  query: withQueryParam(route.query, FINDING_QUERY, String(props.facts.findingId)),
}))
</script>

<template>
  <li class="related-finding-row" :data-finding-id="facts.findingId">
    <div class="name-line">
      <RouterLink v-if="facts.vulnId" class="vuln-id" :to="findingLink">{{
        facts.vulnId
      }}</RouterLink>
      <span v-else class="missing">Finding #{{ facts.findingId }}, no longer in sieb</span>
      <span v-if="facts.imageRef" class="image"><ImageName :image-ref="facts.imageRef" /></span>
      <span class="state">
        <BaseChip v-if="facts.vulnId && !facts.open" outline>resolved</BaseChip>
        <DecisionStateChip
          v-else-if="facts.decision && facts.effective"
          :effective="facts.effective"
          :status="facts.decision.status"
          :justification="facts.decision.justification"
        />
        <span v-else-if="facts.vulnId" class="undecided">Undecided</span>
      </span>
    </div>
    <p v-if="facts.versions.length > 0" class="versions">
      <span v-for="(version, index) in facts.versions" :key="index" class="version">
        <span v-if="version.package" class="package">{{ version.package }}</span>
        {{ version.installedVersion }}
      </span>
    </p>
    <p v-if="facts.note" class="note">{{ facts.note }}</p>
  </li>
</template>

<style scoped>
.related-finding-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
}

.name-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-2);
  min-width: 0;
}

.vuln-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.vuln-id:focus-visible {
  outline: var(--border-width-strong) solid var(--color-focus);
  outline-offset: var(--border-width-strong);
  border-radius: var(--radius-sm);
}

.image {
  min-width: 0;
  max-width: 100%;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.state {
  margin-left: auto;
}

.undecided,
.missing {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}

.versions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}

.package {
  color: var(--color-text-muted);
}

.note {
  font-size: var(--font-size-sm);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
