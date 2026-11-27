<script setup lang="ts">
import type { AccessCredentialView } from '#core/privateAccess.ts'
import AccessTestSummary from '@/components/access/AccessTestSummary.vue'
import BaseChip from '@/components/chips/BaseChip.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BlockableButton from '@/components/common/BlockableButton.vue'
import FactItem from '@/components/common/FactItem.vue'
import FactList from '@/components/common/FactList.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import { coveredTargets, providerLabel, UNREADABLE_REASON, usesText } from '@/format/accessText'

defineProps<{
  credential: AccessCredentialView
  /** Whether a test of this credential runs */
  testing: boolean
}>()

defineEmits<{ test: []; edit: []; delete: [] }>()
</script>

<template>
  <li class="credential-item" :data-credential-id="credential.id" tabindex="-1">
    <div class="line">
      <BaseChip variant="outline">{{ providerLabel(credential) }}</BaseChip>
      <span class="label">{{ credential.label }}</span>
      <span class="uses">{{ usesText(credential.uses) }}</span>
      <BaseChip v-if="credential.secretReadable === false" tone="danger">Token unreadable</BaseChip>
      <div class="actions">
        <BlockableButton
          :as="BaseButton"
          :blocked-by="credential.secretReadable === false ? UNREADABLE_REASON : null"
          blocked-title="No test started"
          :busy="testing"
          :aria-label="`Test ${credential.label}`"
          hint="Tries the credential on the images and repositories it covers"
          @press="$emit('test')"
        >
          {{ testing ? 'Testing…' : 'Test' }}
        </BlockableButton>
        <BaseButton variant="ghost" :aria-label="`Edit ${credential.label}`" @click="$emit('edit')">
          Edit
        </BaseButton>
        <BaseButton
          variant="ghost"
          :aria-label="`Delete ${credential.label}`"
          @click="$emit('delete')"
        >
          Delete
        </BaseButton>
      </div>
    </div>
    <FactList>
      <FactItem label="Covers">
        <span v-for="target in coveredTargets(credential)" :key="target" class="mono block">
          {{ target }}
        </span>
      </FactItem>
      <FactItem v-if="credential.username" label="Username">
        <span class="mono">{{ credential.username }}</span>
      </FactItem>
      <FactItem v-if="credential.repoMapping" label="Repository mapping">
        <span class="mono">
          {{ credential.repoMapping.registryPrefix }} to {{ credential.repoMapping.repoPrefix }}
        </span>
      </FactItem>
      <FactItem label="Added">
        {{ credential.createdBy }}, <RelativeTime :value="credential.createdAt" />
      </FactItem>
      <FactItem label="Last used">
        <RelativeTime :value="credential.lastUsedAt" fallback="never used" />
      </FactItem>
    </FactList>
    <p v-if="credential.secretReadable === false" class="unreadable">{{ UNREADABLE_REASON }}</p>
    <AccessTestSummary :result="credential.lastTest" :testing="testing" />
  </li>
</template>

<style scoped>
.credential-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
}

.credential-item + .credential-item {
  border-top: var(--border-width) solid var(--color-border);
}

.credential-item:focus-visible {
  outline: var(--border-width-strong) solid var(--color-focus);
  outline-offset: calc(-1 * var(--border-width-strong));
}

.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-2);
}

.label {
  min-width: 0;
  font-weight: var(--font-weight-medium);
  overflow-wrap: anywhere;
}

.uses {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-left: auto;
}

.unreadable {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.mono {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

.block {
  display: block;
}
</style>
