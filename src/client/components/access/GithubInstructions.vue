<script setup lang="ts">
import type { AccessUse } from '#core/privateAccess.ts'

defineProps<{
  /** Uses chosen in the form, each gets its own steps */
  uses: AccessUse[]
}>()
</script>

<template>
  <div class="github-instructions">
    <template v-if="uses.includes('git')">
      <p class="part">Source code (github.com)</p>
      <ol>
        <li>
          Create a <strong>fine-grained personal access token</strong>: Settings, Developer
          settings, Personal access tokens, Fine-grained tokens, Generate new token.
        </li>
        <li>
          Repository access: <strong>Only select repositories</strong>, and pick the repositories
          behind your images.
        </li>
        <li>
          Repository permissions: <strong>Contents: Read-only</strong>. Metadata read-only is added
          by GitHub. Leave everything else at no access.
        </li>
      </ol>
    </template>
    <template v-if="uses.includes('registry')">
      <p class="part">Packages (ghcr.io)</p>
      <ol>
        <li>
          Fine-grained tokens do not work with GitHub Packages. Create a
          <strong>personal access token (classic)</strong>: Settings, Developer settings, Personal
          access tokens, Tokens (classic).
        </li>
        <li>Select only the <code>read:packages</code> scope.</li>
        <li>
          A classic token reads every package your account can read; the path prefix limits which
          images sieb uses it for.
        </li>
      </ol>
    </template>
    <p v-if="uses.length > 1" class="tip">
      For the least access, add two credentials: one with the fine-grained token and the use Git,
      one with the classic token and the use Registry.
    </p>
  </div>
</template>

<style scoped src="@/components/access/instructions.css"></style>
