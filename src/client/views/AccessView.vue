<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import AccessDisabled from '@/components/access/AccessDisabled.vue'
import CredentialForm from '@/components/access/CredentialForm.vue'
import CredentialItem from '@/components/access/CredentialItem.vue'
import FetcherNotice from '@/components/access/FetcherNotice.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadState from '@/components/common/LoadState.vue'
import SectionHeading from '@/components/common/SectionHeading.vue'
import { useAccessPage } from '@/composables/useAccessPage'
import { useCredentialsStore } from '@/stores/credentialsStore'

const store = useCredentialsStore()
const page = useAccessPage()
const { formOpen, formCredential, confirmOpen, deleteTarget, deleting } = page
const form = ref<InstanceType<typeof CredentialForm> | null>(null)

watch(formOpen, async (open) => {
  if (open) {
    await nextTick()
    form.value?.focus()
  }
})
</script>

<template>
  <div class="access-view">
    <p class="intro">
      Credentials let Auto-check pull private images and, for your own images, clone the source at
      the image's revision. Each credential covers one host and a path prefix, and any image it
      covers can be checked. Tokens are stored encrypted and never shown again.
    </p>
    <LoadState
      v-if="!store.loaded"
      subject="the credentials"
      :error="store.error"
      @retry="store.load()"
    />
    <AccessDisabled v-else-if="!store.enabled" />
    <template v-else>
      <FetcherNotice v-if="!store.fetcherConfigured" />
      <CredentialForm
        v-if="formOpen"
        ref="form"
        :key="formCredential?.id ?? 'new'"
        :credential="formCredential"
        :save="page.save"
        :test-values="page.testValues"
        @cancel="page.closeForm()"
      />
      <section class="credentials" aria-labelledby="access-credentials">
        <SectionHeading id="access-credentials" :level="2" :count="store.credentials.length">
          Credentials
          <template v-if="!formOpen && store.credentials.length > 0" #aside>
            <BaseButton variant="primary" @click="page.openAdd()">Add credential</BaseButton>
          </template>
        </SectionHeading>
        <ol v-if="store.credentials.length > 0" class="items">
          <CredentialItem
            v-for="credential in store.credentials"
            :key="credential.id"
            :credential="credential"
            :testing="store.isTesting(credential.id)"
            @test="page.test(credential)"
            @edit="page.openEdit(credential)"
            @delete="page.askDelete(credential)"
          />
        </ol>
        <EmptyState v-else-if="!formOpen" title="No credentials yet">
          Add one per registry or git host whose private images and source Auto-check should reach.
          Until then it checks public images only.
          <template #actions>
            <BaseButton variant="primary" @click="page.openAdd()">Add credential</BaseButton>
          </template>
        </EmptyState>
      </section>
    </template>
    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="`Delete ${deleteTarget?.label ?? 'the credential'}?`"
      description="Auto-check can no longer reach the images and repositories it covers. The token is removed from sieb; revoke it at the provider too."
      confirm-label="Delete credential"
      :busy="deleting"
      @confirm="page.confirmDelete()"
    />
  </div>
</template>

<style scoped>
.access-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: var(--content-max-width);
  padding: var(--space-4);
}

.intro {
  max-width: var(--prose-max-width);
  color: var(--color-text-muted);
}

.credentials {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.items {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  list-style: none;
}
</style>
