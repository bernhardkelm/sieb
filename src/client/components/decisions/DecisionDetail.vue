<script setup lang="ts">
import { computed } from 'vue'

import type { DecisionView } from '#core/findingView.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import KeyHint from '@/components/common/KeyHint.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import { decisionWhy } from '@/components/decisions/decisionWhy'
import { useNow } from '@/composables/useNow'
import { formatDate } from '@/format/relativeTime'
import { RECONFIRM_HINT } from '@/format/reopenText'
import { useLabelsStore } from '@/stores/labelsStore'

const props = defineProps<{
  view: DecisionView
  /** Open findings the decision governs, the first opens with o */
  findingCount: number
  /** Disables the re-confirm action while a re-confirm is in flight */
  busy?: boolean
}>()

defineEmits<{ edit: []; revoke: []; openFinding: []; reconfirm: [] }>()

const now = useNow()
const labels = useLabelsStore()

const why = computed(() => decisionWhy(props.view, now.value))
const revoked = computed(() => props.view.decision.revokedAt !== null)
const reopened = computed(() => props.view.effective.state === 'reopened')
</script>

<template>
  <div class="decision-detail">
    <p v-if="why" class="why" :class="{ lapsed: reopened }" role="note">
      {{ why }}.{{ reopened ? ` ${RECONFIRM_HINT}` : '' }}
    </p>
    <p class="reason">{{ view.decision.reason }}</p>
    <p class="meta">
      Decided by {{ view.decision.createdBy }} <RelativeTime :value="view.decision.createdAt" /> ·
      changed <RelativeTime :value="view.decision.updatedAt" /> ·
      {{
        view.decision.expiresAt ? `expires ${formatDate(view.decision.expiresAt)}` : 'never expires'
      }}
      · at {{ view.decision.severityAtDecision
      }}{{ labels.showKev && view.decision.kevAtDecision ? ', KEV' : '' }}
      <template v-if="view.decision.revokedAt">
        · revoked by {{ view.decision.revokedBy ?? 'unknown' }}
        <RelativeTime :value="view.decision.revokedAt" />
      </template>
    </p>
    <div class="actions">
      <BaseButton v-if="reopened" variant="primary" :disabled="busy" @click="$emit('reconfirm')">
        Re-confirm <KeyHint :keys="['c']" />
      </BaseButton>
      <BaseButton v-if="!revoked" @click="$emit('edit')">
        Edit <KeyHint :keys="['e']" />
      </BaseButton>
      <BaseButton v-if="!revoked" @click="$emit('revoke')">
        Revoke <KeyHint :keys="['⌫']" />
      </BaseButton>
      <BaseButton v-if="findingCount > 0" @click="$emit('openFinding')">
        Open finding <KeyHint :keys="['o']" />
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.decision-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
}

.why {
  color: var(--color-warning);
  font-weight: var(--font-weight-medium);
}

.lapsed {
  color: var(--color-danger);
}

.reason {
  color: var(--color-text);
  font-size: var(--font-size-md);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
