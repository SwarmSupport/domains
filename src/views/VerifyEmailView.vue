<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { emailApi } from '@/api'
import Button from '@/components/Button.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const status = ref<'loading' | 'success' | 'error'>('loading')
const message = ref('')

onMounted(async () => {
  const token = route.query.token as string

  if (!token) {
    status.value = 'error'
    message.value = 'Invalid verification link'
    return
  }

  try {
    const { data } = await emailApi.verify(token)
    if (data.success) {
      status.value = 'success'
      message.value = t('auth.emailVerified')
    } else {
      status.value = 'error'
      message.value = data.error || t('auth.emailVerificationFailed')
    }
  } catch {
    status.value = 'error'
    message.value = t('auth.emailVerificationFailed')
  }
})

function goToLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="verify-page">
    <div class="verify-container">
      <div v-if="status === 'loading'" class="loading">
        <div class="spinner"></div>
        <p>{{ t('common.loading') }}</p>
      </div>

      <div v-else-if="status === 'success'" class="success">
        <div class="icon success-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        </div>
        <h1>{{ t('auth.emailVerified') }}</h1>
        <p>{{ message }}</p>
        <Button @click="goToLogin">{{ t('auth.login') }}</Button>
      </div>

      <div v-else class="error-state">
        <div class="icon error-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M15 9l-6 6M9 9l6 6"/>
          </svg>
        </div>
        <h1>{{ t('auth.emailVerificationFailed') }}</h1>
        <p>{{ message }}</p>
        <Button @click="goToLogin">{{ t('auth.login') }}</Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.verify-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, var(--color-bg) 0%, var(--color-primary) 100%);
}

.verify-container {
  width: 100%;
  max-width: 400px;
  padding: 48px;
  background: var(--color-card);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow);
  text-align: center;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  margin-bottom: 24px;
}

.success-icon {
  background: rgba(0, 212, 170, 0.1);
  color: var(--color-accent);
}

.error-icon {
  background: rgba(255, 107, 107, 0.1);
  color: var(--color-danger);
}

h1 {
  font-size: 24px;
  margin-bottom: 12px;
}

p {
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}
</style>
