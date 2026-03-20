<script setup lang="ts">
defineProps<{
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
}>()
</script>

<template>
  <button
    :type="type || 'button'"
    :class="['btn', variant || 'primary', size || 'md', { loading }]"
    :disabled="disabled || loading"
  >
    <svg v-if="loading" class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn.md {
  padding: 10px 20px;
  font-size: 14px;
}

.btn.lg {
  padding: 14px 28px;
  font-size: 16px;
}

.btn.primary {
  background: linear-gradient(135deg, var(--color-accent), #00b894);
  color: #0f1724;
}

.btn.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 212, 170, 0.4);
}

.btn.secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

.btn.secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.btn.danger {
  background: rgba(255, 107, 107, 0.15);
  color: var(--color-danger);
}

.btn.danger:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.25);
}

.btn.ghost {
  background: none;
  color: var(--color-text-secondary);
}

.btn.ghost:hover:not(:disabled) {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.05);
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
