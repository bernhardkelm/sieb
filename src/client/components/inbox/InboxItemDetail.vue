<script setup lang="ts">
import { computed } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import UpstreamPendingChip from '@/components/chips/UpstreamPendingChip.vue'
import ConfidenceChip from '@/components/proposals/ConfidenceChip.vue'
import ProposalClientTag from '@/components/proposals/ProposalClientTag.vue'
import VerdictChip from '@/components/proposals/VerdictChip.vue'
import { useNow } from '@/composables/useNow'
import { expiresText, kevListedText } from '@/format/inboxText'
import { REOPEN_LABELS, STATUS_LABELS } from '@/format/labels'

const props = defineProps<{
  item: InboxItem
}>()

const now = useNow()

const status = computed(() => {
  const { item } = props

  if (item.kind === 'proposal') {
    return null
  }

  return item.decisionStatus === null ? 'Undecided' : STATUS_LABELS[item.decisionStatus]
})
</script>

<template>
  <span class="inbox-item-detail">
    <template v-if="item.kind === 'proposal'">
      <VerdictChip :verdict="item.verdict" />
      <ConfidenceChip :confidence="item.confidence" />
      <UpstreamPendingChip v-if="item.upstreamPending" :waiting-for="null" />
      <ProposalClientTag :client="item" />
      <span v-if="item.patchAction" class="patch" :title="item.patchAction">
        {{ item.patchAction }}
      </span>
    </template>
    <BaseChip v-else-if="item.kind === 'reopened'" tone="danger">
      {{ REOPEN_LABELS[item.reopenReason] }}
    </BaseChip>
    <span v-else-if="item.kind === 'expiring'" class="when">
      {{ expiresText(item.at, now) }}
    </span>
    <span v-else class="when">{{ kevListedText(item.at, now) }}</span>
    <span v-if="status" class="status" :class="{ undecided: status === 'Undecided' }">
      {{ status }}
    </span>
  </span>
</template>

<style scoped>
.inbox-item-detail {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.when {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.status,
.patch {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
}

.undecided {
  color: var(--color-text-subtle);
}
</style>
