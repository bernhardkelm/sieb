<script setup lang="ts">
import type { PackageOrigin } from '#core/packageOrigin.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import CopyButton from '@/components/common/CopyButton.vue'

defineProps<{
  origins: PackageOrigin[]
}>()

/**
 * Splits a path after each slash, so a long path wraps at its separators.
 * @param {string} path - Path from the Trivy report
 * @returns {string[]} - Segments, each ending in a slash except the last
 */
const pathSegments = (path: string): string[] => path.match(/[^/]*\/|[^/]+$/g) ?? [path]
</script>

<template>
  <ul class="found-in">
    <li
      v-for="origin in origins"
      :key="`${origin.package ?? ''} ${origin.installedVersion ?? ''}`"
      class="origin"
    >
      <div class="package">
        <span class="mono">{{ origin.package ?? 'Unknown package' }}</span>
        <span v-if="origin.installedVersion" class="mono version">{{
          origin.installedVersion
        }}</span>
        <BaseChip v-if="origin.packageType" variant="outline">{{ origin.packageType }}</BaseChip>
      </div>
      <ul v-if="origin.paths.length > 0" class="paths" aria-label="Paths">
        <li v-for="path in origin.paths" :key="path" class="mono path">
          <template v-for="(segment, index) in pathSegments(path)" :key="index"
            >{{ segment }}<wbr
          /></template>
        </li>
      </ul>
      <div v-if="origin.purl" class="purl">
        <span class="mono path">{{ origin.purl }}</span>
        <CopyButton :value="origin.purl" label="Copy PURL" />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.found-in,
.paths {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.found-in {
  gap: var(--space-3);
  font-size: var(--font-size-sm);
}

.origin {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.package {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  overflow-wrap: anywhere;
}

.mono {
  font-family: var(--font-mono);
}

.version,
.purl {
  color: var(--color-text-muted);
}

.paths {
  gap: var(--space-0-5);
}

.path {
  min-width: 0;
  overflow-wrap: anywhere;
}

.purl {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
</style>
