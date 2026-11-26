<script setup lang="ts">
defineProps<{
  messages: string[]
}>()
</script>

<template>
  <p v-if="messages.length > 0" class="field-errors">
    <template v-for="(message, index) in messages" :key="index">
      <br v-if="index > 0" />{{ message }}
    </template>
  </p>
</template>

<style scoped>
.field-errors {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}
</style>
