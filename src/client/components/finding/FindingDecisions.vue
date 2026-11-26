<script setup lang="ts">
import { ref } from 'vue'

import type { FindingDetail } from '#core/findingView.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import DecisionCard from '@/components/decision/DecisionCard.vue'
import DecisionForm from '@/components/decision/DecisionForm.vue'
import RevokeDialog from '@/components/decision/RevokeDialog.vue'
import DraftGuardDialog from '@/components/finding/DraftGuardDialog.vue'
import ProposalNotice from '@/components/proposals/ProposalNotice.vue'
import { useDecisionCardActions } from '@/composables/useDecisionCardActions'
import { useDecisionFormMode } from '@/composables/useDecisionFormMode'
import { useFindingDecisionDraft } from '@/composables/useFindingDecisionDraft'
import { shortImageName } from '@/format/imageName'

const props = defineProps<{
  detail: FindingDetail
}>()

const emit = defineEmits<{ saved: [] }>()

const form = ref<InstanceType<typeof DecisionForm> | null>(null)
const modes = useDecisionFormMode(() => props.detail)
const { mode, current, imageDecision, hasAllDecision, formInitial, formKey, showForm } = modes
const draft = useFindingDecisionDraft({
  detail: () => props.detail,
  modes,
  form,
  onSaved: () => emit('saved'),
})
const { error, submitting, formDirty, draftDirty, draftGuarded } = draft
const cards = useDecisionCardActions(() => emit('saved'))
const { revokeTarget, revoking, reconfirming } = cards
</script>

<template>
  <div class="finding-decisions">
    <ProposalNotice :vuln-id="detail.finding.vulnId" :image-ref="detail.finding.imageRef" />
    <DecisionCard
      v-for="view in current"
      v-show="!(mode?.kind === 'edit' && mode.decision.id === view.decision.id)"
      :key="view.decision.id"
      :view="view"
      :governing="current.length > 1 && detail.finding.decision?.id === view.decision.id"
      :busy="reconfirming"
      @edit="mode = { kind: 'edit', decision: view.decision }"
      @revoke="revokeTarget = view.decision"
      @reconfirm="cards.reconfirm(view.decision)"
    />
    <DecisionForm
      v-if="showForm"
      ref="form"
      :key="formKey"
      :initial="formInitial"
      :scope-choice="mode?.kind !== 'edit' && !hasAllDecision"
      :image-label="shortImageName(detail.finding.imageRef)"
      :error="error"
      :submitting="submitting"
      :submit-label="mode?.kind === 'edit' ? 'Save changes' : 'Save decision'"
      :reconfirmable="modes.editReopened.value"
      sticky-actions
      @submit="draft.submit"
      @cancel="draft.cancel"
      @dirty="formDirty = $event"
    />
    <p v-if="draftDirty" class="paused">
      Unsaved draft: j, k and Esc wait until you save or cancel.
    </p>
    <BaseButton v-else-if="!imageDecision" class="add" @click="mode = { kind: 'create' }">
      Decide for this image only
    </BaseButton>
    <RevokeDialog
      :open="revokeTarget !== null"
      :vuln-id="detail.finding.vulnId"
      :busy="revoking"
      @update:open="revokeTarget = $event ? revokeTarget : null"
      @confirm="cards.revoke"
    />
    <DraftGuardDialog :dirty="draftGuarded" @keep="form?.focusReason()" />
  </div>
</template>

<style scoped>
.finding-decisions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.add {
  align-self: flex-start;
}

.paused {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}
</style>
