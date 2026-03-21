<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  siteKey?: string
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'verified'): void
  (e: 'error', error: string): void
}>()

const containerId = `turnstile-${Math.random().toString(36).substring(2, 9)}`
const isLoaded = ref(false)
const isVerified = ref(false)
const error = ref('')

declare global {
  interface Window {
    turnstile: {
      render: (container: string, options: {
        sitekey: string
        callback: (token: string) => void
        'error-callback': () => void
        'expired-callback': () => void
      }) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

let widgetId: string | null = null

onMounted(() => {
  // If no site key or empty, skip Turnstile (disabled)
  if (!props.siteKey || props.siteKey.trim() === '') {
    isLoaded.value = true
    isVerified.value = true
    emit('update:modelValue', 'disabled')
    return
  }

  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
  script.async = true
  script.defer = true
  document.head.appendChild(script)

  script.onload = () => {
    if (window.turnstile && props.siteKey) {
      widgetId = window.turnstile.render(`#${containerId}`, {
        sitekey: props.siteKey,
        callback: (token: string) => {
          isVerified.value = true
          error.value = ''
          emit('update:modelValue', token)
          emit('verified')
        },
        'error-callback': () => {
          error.value = 'Verification failed'
          isVerified.value = false
          emit('error', error.value)
        },
        'expired-callback': () => {
          error.value = 'Verification expired, please try again'
          isVerified.value = false
          emit('update:modelValue', '')
        }
      })
    }
  }
})

onUnmounted(() => {
  if (widgetId && window.turnstile) {
    window.turnstile.remove(widgetId)
  }
})
</script>

<template>
  <div class="turnstile-wrapper">
    <div v-if="!siteKey || siteKey.trim() === ''" class="turnstile-disabled">
      Turnstile is disabled
    </div>
    <div v-else :id="containerId" class="turnstile-container"></div>
    <p v-if="error" class="turnstile-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.turnstile-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.turnstile-container {
  min-height: 65px;
}

.turnstile-disabled {
  padding: 12px 24px;
  background: rgba(139, 163, 185, 0.1);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 14px;
}

.turnstile-error {
  color: var(--color-danger);
  font-size: 14px;
  text-align: center;
}
</style>
