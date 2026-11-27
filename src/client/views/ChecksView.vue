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
        <template v-if="!checks.workerOnline" #actions>
          <p class="offline">The worker is offline right now.</p>
        </template>
      </EmptyState>
      <div v-else class="sections">
        <RunningCheck
          :check="checks.running"
          :worker-online="checks.workerOnline"
          @cancel="requestCancel"
        />
        <CheckQueue :checks="checks.queued" @cancel="requestCancel" />
        <CheckUsageSummary v-if="checks.usage" :summary="checks.usage" />
        <RecentChecks :checks="checks.recent" />
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
  color: var(--color-warning);
}

.sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: var(--content-max-width);
}
</style>
