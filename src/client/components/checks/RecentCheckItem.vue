<script setup lang="ts">
import { computed } from 'vue'

import type { CheckView } from '#core/check.ts'
import CheckChip from '@/components/checks/CheckChip.vue'
import CheckFinding from '@/components/checks/CheckFinding.vue'
import CheckReply from '@/components/checks/CheckReply.vue'
import RetryCheckButton from '@/components/checks/RetryCheckButton.vue'
import FactItem from '@/components/common/FactItem.vue'
import FactList from '@/components/common/FactList.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import { checkedImagesText, costText, usageText } from '@/format/checkResultText'
import { formatCount } from '@/format/count'
import { formatElapsed, NO_FAILURE_REASON } from '@/format/checkText'

const props = defineProps<{
  check: CheckView
}>()

const cost = computed(() => costText(props.check.usage?.costUsd ?? null))
const images = computed(() => checkedImagesText(props.check.pulledImages))
</script>

<template>
  <li class="recent-check" :data-check-id="check.id">
    <div class="line">
      <CheckFinding :check="check" />
      <CheckChip :check="check" focusable />
      <RetryCheckButton :check="check" />
    </div>
    <FactList>
      <FactItem label="Requested by">{{ check.requestedBy }}</FactItem>
      <FactItem label="Finished">
        <RelativeTime :value="check.finishedAt" fallback="not finished" />
      </FactItem>
      <FactItem v-if="check.durationMs !== null" label="Duration">
        {{ formatElapsed(check.durationMs) }}
      </FactItem>
      <FactItem v-if="images !== null" label="Checked images">
        <span class="images">{{ images }}</span>
      </FactItem>
      <FactItem v-if="check.usage?.models?.length" label="Model">
        {{ check.usage.models.join(', ') }}
      </FactItem>
      <FactItem v-if="check.usage && check.usage.turns > 0" label="Turns">
        {{ formatCount(check.usage.turns) }}
      </FactItem>
      <FactItem v-if="check.usage" label="Usage">{{ usageText(check.usage) }}</FactItem>
      <FactItem v-if="cost !== null" label="Cost">
        {{ cost }}
        <span class="estimate">API-equivalent estimate</span>
      </FactItem>
    </FactList>
    <p v-if="check.state === 'failed'" class="error">{{ check.error ?? NO_FAILURE_REASON }}</p>
    <CheckReply v-if="check.reply" :reply="check.reply" />
  </li>
</template>

<style scoped>
.recent-check {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
}

.recent-check + .recent-check {
  border-top: var(--border-width) solid var(--color-border);
}

.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-3);
}

.images {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

.estimate {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

.error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}
</style>
