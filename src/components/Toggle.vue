<script setup lang="ts">
const props = defineProps<{
  modelValue?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    class="toggle"
    :class="{ active: modelValue, disabled }"
    @click="toggle"
    :aria-pressed="modelValue"
  >
    <span class="toggle-slider"></span>
  </button>
</template>

<style scoped>
.toggle {
  position: relative;
  width: 48px;
  height: 26px;
  background: var(--color-border);
  border: none;
  border-radius: 13px;
  cursor: pointer;
  transition: background 0.2s;
  padding: 0;
}

.toggle.active {
  background: var(--color-accent);
}

.toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-slider {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle.active .toggle-slider {
  transform: translateX(22px);
}
</style>
