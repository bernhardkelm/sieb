<script setup lang="ts">
import { computed } from 'vue'

import type { DecisionView } from '#core/findingView.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import DecisionStateChip from '@/components/chips/DecisionStateChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import ImageName from '@/components/common/ImageName.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import { decisionWhy } from '@/components/decisions/decisionWhy'
import CountValue from '@/components/list/CountValue.vue'
import ExpandChevron from '@/components/list/ExpandChevron.vue'
import ListRow from '@/components/list/ListRow.vue'
import { useNow } from '@/composables/useNow'
import { pluralize } from '@/format/count'
import { UPSTREAM_PENDING_LABEL, waitingForText } from '@/format/upstreamText'

const props = defineProps<{
  view: DecisionView
  current: boolean
  expanded: boolean
}>()

defineEmits<{ select: [event: MouseEvent] }>()

const now = useNow()

const why = computed(() => decisionWhy(props.view, now.value))
const lapsed = computed(() => props.view.effective.state === 'reopened')
const reasonHint = computed(() =>
  props.view.decision.upstreamPending
    ? `${waitingForText(props.view.decision.waitingFor)}. ${props.view.decision.reason}`
    : props.view.decision.reason,
)
</script>

<template>
  <ListRow
    class="decision-row"
    :current="current"
    :aria-expanded="expanded"
    @click="$emit('select', $event)"
  >
    <ExpandChevron :expanded="expanded" />
    <span>
      <DecisionStateChip
        :effective="view.effective"
        :status="view.decision.status"
        :justification="view.decision.justification"
      />
    </span>
    <span class="vuln-id">{{ view.decision.vulnId }}</span>
    <span v-if="view.decision.imageRef" class="scope">
      <ImageName :image-ref="view.decision.imageRef" />
    </span>
    <span v-else class="scope all">All images</span>
    <HintTooltip :text="reasonHint">
      <span class="reason" data-panel-clip>
        <BaseChip v-if="view.decision.upstreamPending" class="upstream" tone="warning" outline>
          {{ UPSTREAM_PENDING_LABEL }}
        </BaseChip>
        <span v-if="why" class="why" :class="{ lapsed }">{{ why }} · </span
        >{{ view.decision.reason }}
      </span>
    </HintTooltip>
    <span class="author optional">{{ view.decision.createdBy }}</span>
    <span class="created optional"><RelativeTime :value="view.decision.createdAt" /></span>
    <span class="expires">
      <RelativeTime :value="view.decision.expiresAt" fallback="never" />
    </span>
    <CountValue
      class="count"
      :value="view.openFindings"
      :label="pluralize(view.openFindings, 'open finding')"
    />
  </ListRow>
</template>

<style scoped>
.vuln-id {
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope {
  display: block;
  min-width: 0;
}

.all {
  color: var(--color-accent);
  font-weight: var(--font-weight-medium);
}

.reason,
.author {
  overflow: hidden;
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author,
.created,
.expires {
  font-size: var(--font-size-sm);
}

.created {
  color: var(--color-text-muted);
}

.upstream {
  margin-right: var(--space-1-5);
  vertical-align: middle;
}

.why {
  color: var(--color-warning);
  font-weight: var(--font-weight-medium);
}

.lapsed {
  color: var(--color-danger);
}

.expires {
  color: var(--color-text-subtle);
}

@container (max-width: 900px) {
  .optional {
    display: none;
  }
}

@container (max-width: 640px) {
  .vuln-id {
    flex: 1 1 0;
    min-width: calc(var(--space-base) * 24);
  }

  .scope,
  .reason,
  .expires {
    order: 2;
  }

  .scope {
    flex: 0 1 auto;
    max-width: 40%;
    margin-left: calc(var(--chevron-size) + var(--space-2));
    font-size: var(--font-size-sm);
  }

  .reason {
    flex: 1 1 0;
    min-width: 0;
    font-size: var(--font-size-sm);
  }
}
</style>
