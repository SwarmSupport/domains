<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { settingApi } from '@/api'
import { setLocale, getLocale } from '@/i18n'
import InputField from '@/components/InputField.vue'
import Button from '@/components/Button.vue'
import Turnstile from '@/components/Turnstile.vue'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const email = ref('')
const password = ref('')
const turnstileToken = ref('')
const turnstileSiteKey = ref('')
const error = ref('')
const currentLocale = ref(getLocale())

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

function switchLanguage(lang: 'zh' | 'en') {
  setLocale(lang)
  currentLocale.value = lang
}

async function handleLogin() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = t('auth.fillAllFields')
    return
  }

  const result = await authStore.login(email.value, password.value, turnstileToken.value)

  if (result.success) {
    // Check if there's a stored redirect path
    const redirectPath = sessionStorage.getItem('redirectAfterLogin')
    if (redirectPath) {
      sessionStorage.removeItem('redirectAfterLogin')
      router.push(redirectPath)
    } else {
      router.push('/dashboard')
    }
  } else if (result.needsVerification) {
    error.value = t('auth.verificationRequired')
  } else {
    error.value = result.error || t('auth.invalidCredentials')
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="language-switcher">
      <button
        :class="['lang-btn', { active: currentLocale === 'zh' }]"
        @click="switchLanguage('zh')"
      >
        中文
      </button>
      <button
        :class="['lang-btn', { active: currentLocale === 'en' }]"
        @click="switchLanguage('en')"
      >
        EN
      </button>
    </div>

    <div class="auth-container">
      <div class="auth-header">
        <div class="logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <h1>{{ t('auth.loginTitle') }}</h1>
        <p>{{ t('auth.loginSubtitle') }}</p>
      </div>

      <form @submit.prevent="handleLogin" class="auth-form">
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
        <Turnstile
          v-if="turnstileSiteKey"
          :site-key="turnstileSiteKey"
          v-model="turnstileToken"
          class="turnstile"
        />
        <p v-if="error" class="error">{{ error }}</p>
        <Button type="submit" :loading="authStore.loading">
          {{ t('auth.login') }}
        </Button>
      </form>

      <p class="auth-footer">
        {{ t('auth.noAccount') }} <router-link to="/register">{{ t('auth.registerNow') }}</router-link>
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

.language-switcher {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  z-index: 100;
}

.lang-btn {
  padding: 8px 16px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.lang-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.lang-btn.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
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

.auth-footer {
  text-align: center;
  margin-top: 24px;
  color: var(--color-text-secondary);
}
</style>
