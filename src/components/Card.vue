<script setup lang="ts">
const props = defineProps<{
  customClass?: string
}>()
</script>

<template>
  <div :class="['card', props.customClass]">
    <slot />
  </div>
</template>

<style scoped>
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow);
  transition: all var(--transition-fast);
}

.card:hover {
  border-color: rgba(255, 255, 255, 0.15);
}
</style>
