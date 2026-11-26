<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { Decision, DecisionStatus } from '#core/decision.ts'
import type { FindingDetail } from '#core/findingView.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import DecisionCard from '@/components/decision/DecisionCard.vue'
import DecisionForm from '@/components/decision/DecisionForm.vue'
import RevokeDialog from '@/components/decision/RevokeDialog.vue'
import {
  initialFromDecision,
  type DecisionFormInitial,
  type DecisionFormValue,
} from '@/components/decision/decisionFormModel'
import { useDecisionCommands } from '@/composables/useDecisionCommands'
import { shortImageName } from '@/format/imageName'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

type Mode = { kind: 'create' } | { kind: 'edit'; decision: Decision } | null

const props = defineProps<{
  detail: FindingDetail
}>()

const emit = defineEmits<{ saved: [] }>()

const store = useFindingDetailStore()
const commands = useDecisionCommands()

const form = ref<InstanceType<typeof DecisionForm> | null>(null)
const mode = ref<Mode>(null)
const error = ref<unknown>(null)
const submitting = ref(false)
const revokeTarget = ref<Decision | null>(null)
const revoking = ref(false)
const reconfirming = ref(false)
const formDirty = ref(false)
let handledToken = 0

const current = computed(() =>
  props.detail.decisions.filter((view) => view.effective.state !== 'revoked'),
)
const imageDecision = computed(
  () => current.value.find((view) => view.decision.scope === 'image')?.decision ?? null,
)
const hasAllDecision = computed(() => current.value.some((view) => view.decision.scope === 'all'))
const formInitial = computed<DecisionFormInitial>(() =>
  mode.value?.kind === 'edit'
    ? initialFromDecision(mode.value.decision, new Date())
    : { scope: 'image' },
)
const formKey = computed(() =>
  mode.value?.kind === 'edit'
    ? `edit-${mode.value.decision.id}`
    : `create-${props.detail.finding.id}`,
)
const showForm = computed(() => mode.value !== null || current.value.length === 0)
const editReopened = computed(() => {
  const edited = mode.value?.kind === 'edit' ? mode.value.decision.id : null

  return current.value.some(
    (view) => view.decision.id === edited && view.effective.state === 'reopened',
  )
})
const draftDirty = computed(() => showForm.value && formDirty.value)

/**
 * Opens the form for a status: editing the image decision of the finding when there is one,
 * creating one otherwise, then focuses the reason.
 * @param {DecisionStatus} status - Preselected status
 * @returns {Promise<void>} - Resolves once focused
 */
const openForm = async (status: DecisionStatus): Promise<void> => {
  mode.value = imageDecision.value
    ? { kind: 'edit', decision: imageDecision.value }
    : { kind: 'create' }
  error.value = null
  await nextTick()
  form.value?.setStatus(status)
  form.value?.focusReason()
}

/**
 * Saves the form through the decision commands.
 * @param {DecisionFormValue} value - Form values
 * @returns {Promise<void>} - Resolves when saved or failed
 */
const onSubmit = async (value: DecisionFormValue): Promise<void> => {
  const existing = mode.value?.kind === 'edit' ? mode.value.decision : null

  submitting.value = true
  error.value = null

  try {
    await commands.save(props.detail.finding, existing, {
      ...value,
      scope: existing?.scope ?? value.scope,
    })
    mode.value = null
    emit('saved')
  } catch (failure) {
    error.value = failure
  } finally {
    submitting.value = false
  }
}

/**
 * Revokes the decision chosen in the dialog.
 * @param {string} comment - Optional comment
 * @returns {Promise<void>} - Resolves when revoked or failed
 */
const onRevoke = async (comment: string): Promise<void> => {
  if (!revokeTarget.value) {
    return
  }

  revoking.value = true

  try {
    await commands.revoke(revokeTarget.value.id, comment)
    revokeTarget.value = null
  } catch {
    // failure toasted by the command, the dialog stays open for a retry
  } finally {
    revoking.value = false
  }
}

/**
 * Re-confirms a re-opened decision, so it silences again.
 * @param {Decision} decision - Re-opened decision
 * @returns {Promise<void>} - Resolves when re-confirmed or failed
 */
const onReconfirm = async (decision: Decision): Promise<void> => {
  reconfirming.value = true

  try {
    await commands.reconfirm(decision)
    emit('saved')
  } catch {
    // failure toasted by the command
  } finally {
    reconfirming.value = false
  }
}

watch(
  [() => store.decisionRequest, () => props.detail.finding.id],
  ([request, findingId], previous) => {
    if (previous !== undefined && previous[1] !== findingId) {
      mode.value = null
      error.value = null
      formDirty.value = false
    }

    if (request && request.token !== handledToken && request.findingId === findingId) {
      handledToken = request.token
      void openForm(request.status)
    }
  },
  { immediate: true },
)

watch(
  draftDirty,
  (dirty) => {
    store.setDraftDirty(dirty)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  store.setDraftDirty(false)
})
</script>

<template>
  <div class="finding-decisions">
    <DecisionCard
      v-for="view in current"
      v-show="!(mode?.kind === 'edit' && mode.decision.id === view.decision.id)"
      :key="view.decision.id"
      :view="view"
      :governing="current.length > 1 && detail.finding.decision?.id === view.decision.id"
      :busy="reconfirming"
      @edit="mode = { kind: 'edit', decision: view.decision }"
      @revoke="revokeTarget = view.decision"
      @reconfirm="onReconfirm(view.decision)"
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
      :reconfirmable="editReopened"
      @submit="onSubmit"
      @cancel="mode = null"
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
      @confirm="onRevoke"
    />
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
