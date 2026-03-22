<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { settingApi } from '@/api'
import { useI18n } from 'vue-i18n'
import Card from '@/components/Card.vue'
import InputField from '@/components/InputField.vue'
import Button from '@/components/Button.vue'
import Toggle from '@/components/Toggle.vue'

const { t } = useI18n()

// DNS & Domain settings
const dnspodToken = ref('')
const domainSuffixes = ref('')
const dnsLoading = ref(false)
const dnsSaved = ref(false)
const dnsError = ref('')
const dnsTestLoading = ref(false)
const dnsTestResult = ref<{ success: boolean; message: string } | null>(null)

// Turnstile settings
const turnstileEnabled = ref(false)
const turnstileSiteKey = ref('')
const turnstileSecretKey = ref('')
const turnstileLoading = ref(false)
const turnstileSaved = ref(false)
const turnstileError = ref('')
const turnstileTestLoading = ref(false)
const turnstileTestResult = ref<{ success: boolean; message: string } | null>(null)

// Email settings
const emailEnabled = ref(false)
const resendApiKey = ref('')
const resendDomain = ref('')
const fromEmail = ref('')
const emailLoading = ref(false)
const emailSaved = ref(false)
const emailError = ref('')
const emailTestLoading = ref(false)
const emailTestResult = ref<{ success: boolean; message: string } | null>(null)

// Initial loading state
const initialLoading = ref(true)

onMounted(async () => {
  try {
    const [
      { data: token },
      { data: suffixes },
      { data: turnstileEn },
      { data: turnstileSite },
      { data: turnstileSecret },
      { data: emailEn },
      { data: resendKey },
      { data: resendDom },
      { data: from }
    ] = await Promise.all([
      settingApi.get('DNSPOD_TOKEN'),
      settingApi.get('DOMAIN_SUFFIXES'),
      settingApi.get('TURNSTILE_ENABLED'),
      settingApi.get('TURNSTILE_SITE_KEY'),
      settingApi.get('TURNSTILE_SECRET_KEY'),
      settingApi.get('EMAIL_ENABLED'),
      settingApi.get('RESEND_API_KEY'),
      settingApi.get('RESEND_DOMAIN'),
      settingApi.get('FROM_EMAIL')
    ])

    if (token.success && token.data) dnspodToken.value = token.data.value
    if (suffixes.success && suffixes.data) domainSuffixes.value = suffixes.data.value
    if (turnstileEn.success && turnstileEn.data) turnstileEnabled.value = turnstileEn.data.value !== 'false' && turnstileEn.data.value !== '0'
    if (turnstileSite.success && turnstileSite.data) turnstileSiteKey.value = turnstileSite.data.value
    if (turnstileSecret.success && turnstileSecret.data) turnstileSecretKey.value = turnstileSecret.data.value
    if (emailEn.success && emailEn.data) emailEnabled.value = emailEn.data.value !== 'false' && emailEn.data.value !== '0'
    if (resendKey.success && resendKey.data) resendApiKey.value = resendKey.data.value
    if (resendDom.success && resendDom.data) resendDomain.value = resendDom.data.value
    if (from.success && from.data) fromEmail.value = from.data.value
  } catch (e) {
    console.error('Failed to load settings:', e)
  } finally {
    initialLoading.value = false
  }
})

// DNS & Domain handlers
async function handleSaveDns() {
  dnsLoading.value = true
  dnsError.value = ''
  dnsSaved.value = false
  try {
    await Promise.all([
      settingApi.set('DNSPOD_TOKEN', dnspodToken.value),
      settingApi.set('DOMAIN_SUFFIXES', domainSuffixes.value)
    ])
    dnsSaved.value = true
    setTimeout(() => dnsSaved.value = false, 3000)
  } catch (e) {
    dnsError.value = t('admin.settings.saveFailed')
  } finally {
    dnsLoading.value = false
  }
}

async function handleTestDnspod() {
  dnsTestLoading.value = true
  dnsTestResult.value = null
  try {
    // First save the token
    await settingApi.set('DNSPOD_TOKEN', dnspodToken.value)
    const response = await fetch('/api/settings/test-dnspod', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    const result = await response.json()
    dnsTestResult.value = result
  } catch (e: any) {
    dnsTestResult.value = { success: false, message: e.message }
  } finally {
    dnsTestLoading.value = false
  }
}

// Turnstile handlers
async function handleSaveTurnstile() {
  turnstileLoading.value = true
  turnstileError.value = ''
  turnstileSaved.value = false
  try {
    await Promise.all([
      settingApi.set('TURNSTILE_ENABLED', turnstileEnabled.value ? 'true' : 'false'),
      settingApi.set('TURNSTILE_SITE_KEY', turnstileSiteKey.value),
      settingApi.set('TURNSTILE_SECRET_KEY', turnstileSecretKey.value)
    ])
    turnstileSaved.value = true
    setTimeout(() => turnstileSaved.value = false, 3000)
  } catch (e) {
    turnstileError.value = t('admin.settings.saveFailed')
  } finally {
    turnstileLoading.value = false
  }
}

async function handleTestTurnstile() {
  turnstileTestLoading.value = true
  turnstileTestResult.value = null
  try {
    await Promise.all([
      settingApi.set('TURNSTILE_ENABLED', turnstileEnabled.value ? 'true' : 'false'),
      settingApi.set('TURNSTILE_SITE_KEY', turnstileSiteKey.value),
      settingApi.set('TURNSTILE_SECRET_KEY', turnstileSecretKey.value)
    ])
    const response = await fetch('/api/settings/test-turnstile', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    const result = await response.json()
    turnstileTestResult.value = result
  } catch (e: any) {
    turnstileTestResult.value = { success: false, message: e.message }
  } finally {
    turnstileTestLoading.value = false
  }
}

// Email handlers
async function handleSaveEmail() {
  emailLoading.value = true
  emailError.value = ''
  emailSaved.value = false
  try {
    await Promise.all([
      settingApi.set('EMAIL_ENABLED', emailEnabled.value ? 'true' : 'false'),
      settingApi.set('RESEND_API_KEY', resendApiKey.value),
      settingApi.set('RESEND_DOMAIN', resendDomain.value),
      settingApi.set('FROM_EMAIL', fromEmail.value)
    ])
    emailSaved.value = true
    setTimeout(() => emailSaved.value = false, 3000)
  } catch (e) {
    emailError.value = t('admin.settings.saveFailed')
  } finally {
    emailLoading.value = false
  }
}

async function handleTestResend() {
  emailTestLoading.value = true
  emailTestResult.value = null
  try {
    await Promise.all([
      settingApi.set('RESEND_API_KEY', resendApiKey.value),
      settingApi.set('RESEND_DOMAIN', resendDomain.value)
    ])
    const response = await fetch('/api/settings/test-resend', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    const result = await response.json()
    emailTestResult.value = result
  } catch (e: any) {
    emailTestResult.value = { success: false, message: e.message }
  } finally {
    emailTestLoading.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <h2 class="page-title">{{ t('admin.settings.title') }}</h2>

    <div v-if="initialLoading" class="loading">
      {{ t('admin.settings.loading') }}
    </div>

    <div v-else class="settings-grid">
      <!-- DNS & Domains Card -->
      <Card class="settings-card">
        <template #header>
          <h3>{{ t('admin.settings.dnsAndDomains') }}</h3>
        </template>

        <div class="form-stack">
          <div class="field-group">
            <label class="field-label">{{ t('admin.settings.dnspodToken') }}</label>
            <p class="field-desc">{{ t('admin.settings.dnspodDesc') }}</p>
            <InputField
              v-model="dnspodToken"
              type="password"
              placeholder="12345,abcdefgh1234567890..."
            />
          </div>

          <div class="field-group">
            <label class="field-label">{{ t('admin.settings.domainSuffixes') }}</label>
            <p class="field-desc">{{ t('admin.settings.domainSuffixesDesc') }}</p>
            <textarea
              v-model="domainSuffixes"
              class="textarea-field"
              rows="3"
            ></textarea>
          </div>
        </div>

        <p v-if="dnsError" class="error-text">{{ dnsError }}</p>
        <p v-if="dnsSaved" class="success-text">{{ t('admin.settings.settingsSaved') }}</p>

        <div v-if="dnsTestResult" :class="['test-result', dnsTestResult.success ? 'success' : 'error']">
          {{ dnsTestResult.message }}
        </div>

        <div class="card-actions">
          <Button variant="secondary" @click="handleTestDnspod" :loading="dnsTestLoading">
            {{ t('common.test') }}
          </Button>
          <Button @click="handleSaveDns" :loading="dnsLoading" :disabled="dnsSaved">
            {{ t('common.save') }}
          </Button>
        </div>
      </Card>

      <!-- Cloudflare Turnstile Card -->
      <Card class="settings-card">
        <template #header>
          <h3>{{ t('admin.settings.cloudflareConfig') }}</h3>
        </template>

        <div class="toggle-row">
          <span class="toggle-label">{{ t('admin.settings.enableTurnstile') }}</span>
          <Toggle v-model="turnstileEnabled" />
        </div>

        <div class="form-stack">
          <InputField
            v-model="turnstileSiteKey"
            :label="t('admin.settings.turnstileSiteKey')"
            placeholder="0xxx..."
          />
          <InputField
            v-model="turnstileSecretKey"
            :label="t('admin.settings.turnstileSecretKey')"
            type="password"
            placeholder="0xxx..."
          />
        </div>

        <p v-if="turnstileError" class="error-text">{{ turnstileError }}</p>
        <p v-if="turnstileSaved" class="success-text">{{ t('admin.settings.settingsSaved') }}</p>

        <div v-if="turnstileTestResult" :class="['test-result', turnstileTestResult.success ? 'success' : 'error']">
          {{ turnstileTestResult.message }}
        </div>

        <div class="card-actions">
          <Button variant="secondary" @click="handleTestTurnstile" :loading="turnstileTestLoading">
            {{ t('common.test') }}
          </Button>
          <Button @click="handleSaveTurnstile" :loading="turnstileLoading" :disabled="turnstileSaved">
            {{ t('common.save') }}
          </Button>
        </div>
      </Card>

      <!-- Email Service Card -->
      <Card class="settings-card">
        <template #header>
          <h3>{{ t('admin.settings.resendConfig') }}</h3>
        </template>

        <div class="toggle-row">
          <span class="toggle-label">{{ t('admin.settings.enableEmail') }}</span>
          <Toggle v-model="emailEnabled" />
        </div>

        <div class="form-stack">
          <InputField
            v-model="resendApiKey"
            :label="t('admin.settings.resendApiKey')"
            type="password"
            placeholder="re_xxx..."
          />
          <InputField
            v-model="resendDomain"
            :label="t('admin.settings.resendDomain')"
            placeholder="domain.com"
          />
          <InputField
            v-model="fromEmail"
            :label="t('admin.settings.fromEmail')"
            placeholder="noreply@domain.com"
          />
        </div>

        <p v-if="emailError" class="error-text">{{ emailError }}</p>
        <p v-if="emailSaved" class="success-text">{{ t('admin.settings.settingsSaved') }}</p>

        <div v-if="emailTestResult" :class="['test-result', emailTestResult.success ? 'success' : 'error']">
          {{ emailTestResult.message }}
        </div>

        <div class="card-actions">
          <Button variant="secondary" @click="handleTestResend" :loading="emailTestLoading">
            {{ t('common.test') }}
          </Button>
          <Button @click="handleSaveEmail" :loading="emailLoading" :disabled="emailSaved">
            {{ t('common.save') }}
          </Button>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.page-title {
  font-size: 24px;
  margin-bottom: 24px;
}

.loading {
  text-align: center;
  padding: 60px;
  color: var(--color-text-secondary);
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-card {
  transition: box-shadow 0.2s ease;
}

.settings-card:hover {
  box-shadow: var(--shadow-lg);
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.field-desc {
  color: var(--color-text-secondary);
  font-size: 13px;
  margin: 0;
  line-height: 1.4;
}

.format-hint {
  display: inline-block;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: monospace;
  width: fit-content;
}

.textarea-field {
  width: 100%;
  padding: 12px 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 14px;
  font-family: monospace;
  resize: vertical;
  box-sizing: border-box;
}

.textarea-field:focus {
  outline: none;
  border-color: var(--color-accent);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 8px;
}

.toggle-label {
  font-size: 14px;
  color: var(--color-text);
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.error-text {
  color: var(--color-danger);
  font-size: 14px;
  margin: 8px 0 0 0;
}

.success-text {
  color: var(--color-accent);
  font-size: 14px;
  margin: 8px 0 0 0;
}

.test-result {
  padding: 12px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  margin-top: 12px;
}

.test-result.success {
  background: rgba(0, 212, 170, 0.1);
  color: var(--color-accent);
}

.test-result.error {
  background: rgba(255, 107, 107, 0.1);
  color: var(--color-danger);
}
</style>
