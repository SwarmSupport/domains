<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  modelValue: string | number
  type?: string
  label?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const showPassword = ref(false)

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', props.type === 'number' ? Number(target.value) : target.value)
}
</script>

<template>
  <div class="input-field">
    <label v-if="label" class="label">{{ label }}</label>
    <div class="input-wrapper">
      <input
        :type="type === 'password' && showPassword ? 'text' : type || 'text'"
        :value="modelValue"
        :placeholder="placeholder"
        @input="handleInput"
        class="input"
      />
      <button
        v-if="type === 'password'"
        type="button"
        class="toggle-password"
        @click="showPassword = !showPassword"
      >
        <svg v-if="showPassword" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.input-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input {
  width: 100%;
  padding: 12px 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 14px;
  transition: all var(--transition-fast);
}

.input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.6;
}

.input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.1);
}

.toggle-password {
  position: absolute;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  color: var(--color-text-secondary);
  padding: 4px;
  transition: color var(--transition-fast);
}

.toggle-password:hover {
  color: var(--color-text);
}
</style>
