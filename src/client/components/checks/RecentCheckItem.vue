<script setup lang="ts">
import { computed } from 'vue'

import type { CheckView } from '#core/check.ts'
import CheckChip from '@/components/checks/CheckChip.vue'
import CheckFinding from '@/components/checks/CheckFinding.vue'
import CheckReply from '@/components/checks/CheckReply.vue'
import RetryCheckButton from '@/components/checks/RetryCheckButton.vue'
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
    <dl class="facts">
      <div>
        <dt>Requested by</dt>
        <dd>{{ check.requestedBy }}</dd>
      </div>
      <div>
        <dt>Finished</dt>
        <dd><RelativeTime :value="check.finishedAt" fallback="not finished" /></dd>
      </div>
      <div v-if="check.durationMs !== null">
        <dt>Duration</dt>
        <dd>{{ formatElapsed(check.durationMs) }}</dd>
      </div>
      <div v-if="images !== null">
        <dt>Checked images</dt>
        <dd class="images">{{ images }}</dd>
      </div>
      <div v-if="check.usage?.models?.length">
        <dt>Model</dt>
        <dd>{{ check.usage.models.join(', ') }}</dd>
      </div>
      <div v-if="check.usage && check.usage.turns > 0">
        <dt>Turns</dt>
        <dd>{{ formatCount(check.usage.turns) }}</dd>
      </div>
      <div v-if="check.usage">
        <dt>Usage</dt>
        <dd>{{ usageText(check.usage) }}</dd>
      </div>
      <div v-if="cost !== null">
        <dt>Cost</dt>
        <dd>
          {{ cost }}
          <span class="estimate">API-equivalent estimate</span>
        </dd>
      </div>
    </dl>
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

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-5);
  margin: 0;
  font-size: var(--font-size-sm);
}

.facts dt {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

.facts dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.facts .images {
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
