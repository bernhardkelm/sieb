<script setup lang="ts">
import CheckQueue from '@/components/checks/CheckQueue.vue'
import CheckUsageSummary from '@/components/checks/CheckUsageSummary.vue'
import ChecksDisabled from '@/components/checks/ChecksDisabled.vue'
import RecentChecks from '@/components/checks/RecentChecks.vue'
import RunningCheck from '@/components/checks/RunningCheck.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadState from '@/components/common/LoadState.vue'
import { useChecksPage } from '@/composables/useChecksPage'
import { useChecksStore } from '@/stores/checksStore'

const checks = useChecksStore()
const { empty, confirmOpen, confirmText, cancelling, requestCancel, confirmCancel } =
  useChecksPage()
</script>

<template>
  <div class="checks-view">
    <LoadState
      v-if="!checks.loaded"
      subject="checks"
      :error="checks.error"
      @retry="checks.refresh()"
    />
    <ChecksDisabled v-else-if="!checks.enabled" />
    <template v-else>
      <EmptyState v-if="empty" title="No checks yet">
        Pick Auto-check on a finding of a public image, in its panel or for selected rows in Triage.
        Claude checks one finding at a time and files a proposal to the Inbox.
        <span v-if="!checks.workerOnline" class="offline">The worker is offline right now.</span>
      </EmptyState>
      <div v-else class="sections">
        <RunningCheck
          :check="checks.response?.running ?? null"
          :worker-online="checks.workerOnline"
          @cancel="requestCancel"
        />
        <CheckQueue :checks="checks.response?.queued ?? []" @cancel="requestCancel" />
        <CheckUsageSummary v-if="checks.response?.usage" :summary="checks.response.usage" />
        <RecentChecks :checks="checks.response?.recent ?? []" />
      </div>
    </template>
    <ConfirmDialog
      v-model:open="confirmOpen"
      title="Cancel the running check?"
      :description="confirmText"
      confirm-label="Cancel check"
      cancel-label="Keep running"
      :busy="cancelling"
      @confirm="confirmCancel"
    />
  </div>
</template>

<style scoped>
.checks-view {
  padding: var(--space-4);
}

.offline {
  display: block;
  margin-top: var(--space-2);
  color: var(--color-warning);
}

.sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: calc(var(--space-base) * 240);
}
</style>
