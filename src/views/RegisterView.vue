<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { settingApi } from '@/api'
import InputField from '@/components/InputField.vue'
import Button from '@/components/Button.vue'
import Turnstile from '@/components/Turnstile.vue'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const turnstileToken = ref('')
const turnstileSiteKey = ref('')
const error = ref('')
const successMessage = ref('')

onMounted(async () => {
  try {
    const { data } = await settingApi.get('TURNSTILE_SITE_KEY')
    if (data.success && data.data?.value) {
      turnstileSiteKey.value = data.data.value
    }
  } catch (e) {
    console.error('Failed to load Turnstile site key')
  }
})

async function handleRegister() {
  error.value = ''
  successMessage.value = ''

  if (!username.value || !email.value || !password.value || !confirmPassword.value) {
    error.value = t('auth.fillAllFields')
    return
  }

  if (username.value.length < 3 || username.value.length > 20) {
    error.value = t('auth.usernameLength')
    return
  }

  if (password.value.length < 6) {
    error.value = t('auth.passwordTooShort')
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = t('auth.passwordMismatch')
    return
  }

  const result = await authStore.register(username.value, email.value, password.value, turnstileToken.value)
  if (result.success) {
    successMessage.value = result.message || 'Registration successful'
  } else {
    error.value = result.error || t('auth.registerFailed')
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <div class="logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <h1>{{ t('auth.registerTitle') }}</h1>
        <p>{{ t('auth.registerSubtitle') }}</p>
      </div>

      <div v-if="successMessage" class="success-message">
        <p>{{ successMessage }}</p>
        <router-link to="/login">{{ t('auth.loginNow') }}</router-link>
      </div>

      <form v-else @submit.prevent="handleRegister" class="auth-form">
        <InputField
          v-model="username"
          :label="t('auth.username')"
          :placeholder="t('auth.usernamePlaceholder')"
        />
        <InputField
          v-model="email"
          type="email"
          :label="t('auth.email')"
          :placeholder="t('auth.emailPlaceholder')"
        />
        <InputField
          v-model="password"
          type="password"
          :label="t('auth.password')"
          :placeholder="t('auth.passwordPlaceholder')"
        />
        <InputField
          v-model="confirmPassword"
          type="password"
          :label="t('auth.confirmPassword')"
          :placeholder="t('auth.confirmPasswordPlaceholder')"
        />
        <Turnstile
          v-if="turnstileSiteKey"
          :site-key="turnstileSiteKey"
          v-model="turnstileToken"
          class="turnstile"
        />
        <p v-if="error" class="error">{{ error }}</p>
        <Button type="submit" :loading="authStore.loading">
          {{ t('auth.register') }}
        </Button>
      </form>

      <p class="auth-footer">
        {{ t('auth.hasAccount') }} <router-link to="/login">{{ t('auth.loginNow') }}</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, var(--color-bg) 0%, var(--color-primary) 100%);
}

.auth-container {
  width: 100%;
  max-width: 400px;
  padding: 48px;
  background: var(--color-card);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow);
}

.auth-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--color-accent), var(--color-secondary));
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
  color: white;
}

.auth-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.auth-header p {
  color: var(--color-text-secondary);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.turnstile {
  display: flex;
  justify-content: center;
}

.error {
  color: var(--color-danger);
  font-size: 14px;
  text-align: center;
}

.success-message {
  text-align: center;
  padding: 20px;
  background: rgba(0, 212, 170, 0.1);
  border-radius: var(--radius-md);
  margin-bottom: 20px;
}

.success-message p {
  color: var(--color-accent);
  margin-bottom: 12px;
}

.success-message a {
  color: var(--color-accent);
  font-weight: 500;
}

.auth-footer {
  text-align: center;
  margin-top: 24px;
  color: var(--color-text-secondary);
}
</style>
