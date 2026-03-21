<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { settingApi } from '@/api'
import { useI18n } from 'vue-i18n'
import Card from '@/components/Card.vue'
import InputField from '@/components/InputField.vue'
import Button from '@/components/Button.vue'
import Toggle from '@/components/Toggle.vue'

const { t } = useI18n()

const dnspodToken = ref('')
const allowedDomains = ref('')
const turnstileEnabled = ref(false)
const turnstileSiteKey = ref('')
const turnstileSecretKey = ref('')
const emailEnabled = ref(false)
const resendApiKey = ref('')
const resendDomain = ref('')
const fromEmail = ref('')
const loading = ref(false)
const saved = ref(false)

onMounted(async () => {
  try {
    const [dnspod, allowed, turnstileEn, turnstileSite, turnstileSecret, emailEn, resendKey, resendDom, from] = await Promise.all([
      settingApi.get('DNSPOD_TOKEN'),
      settingApi.get('ALLOWED_DOMAINS'),
      settingApi.get('TURNSTILE_ENABLED'),
      settingApi.get('TURNSTILE_SITE_KEY'),
      settingApi.get('TURNSTILE_SECRET_KEY'),
      settingApi.get('EMAIL_ENABLED'),
      settingApi.get('RESEND_API_KEY'),
      settingApi.get('RESEND_DOMAIN'),
      settingApi.get('FROM_EMAIL')
    ])

    if (dnspod.data.success && dnspod.data.data) dnspodToken.value = dnspod.data.data.value
    if (allowed.data.success && allowed.data.data) allowedDomains.value = allowed.data.data.value
    if (turnstileEn.data.success && turnstileEn.data.data) turnstileEnabled.value = turnstileEn.data.data.value !== 'false' && turnstileEn.data.data.value !== '0'
    if (turnstileSite.data.success && turnstileSite.data.data) turnstileSiteKey.value = turnstileSite.data.data.value
    if (turnstileSecret.data.success && turnstileSecret.data.data) turnstileSecretKey.value = turnstileSecret.data.data.value
    if (emailEn.data.success && emailEn.data.data) emailEnabled.value = emailEn.data.data.value !== 'false' && emailEn.data.data.value !== '0'
    if (resendKey.data.success && resendKey.data.data) resendApiKey.value = resendKey.data.data.value
    if (resendDom.data.success && resendDom.data.data) resendDomain.value = resendDom.data.data.value
    if (from.data.success && from.data.data) fromEmail.value = from.data.data.value
  } catch (e) {
    console.error('Failed to load settings')
  }
})

async function handleSave() {
  loading.value = true
  saved.value = false
  try {
    await Promise.all([
      settingApi.set('DNSPOD_TOKEN', dnspodToken.value),
      settingApi.set('ALLOWED_DOMAINS', allowedDomains.value),
      settingApi.set('TURNSTILE_ENABLED', turnstileEnabled.value ? 'true' : 'false'),
      settingApi.set('TURNSTILE_SITE_KEY', turnstileSiteKey.value),
      settingApi.set('TURNSTILE_SECRET_KEY', turnstileSecretKey.value),
      settingApi.set('EMAIL_ENABLED', emailEnabled.value ? 'true' : 'false'),
      settingApi.set('RESEND_API_KEY', resendApiKey.value),
      settingApi.set('RESEND_DOMAIN', resendDomain.value),
      settingApi.set('FROM_EMAIL', fromEmail.value)
    ])
    saved.value = true
    setTimeout(() => saved.value = false, 3000)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <Card>
      <template #header>
        <h3>{{ t('admin.settings.title') }}</h3>
      </template>

      <div class="settings-form">
        <div class="setting-section">
          <h4>{{ t('admin.settings.dnspodConfig') }}</h4>
          <p class="setting-desc">
            {{ t('admin.settings.dnspodDesc') }}<br>
            {{ t('admin.settings.dnspodFormat') }}
          </p>
          <InputField
            v-model="dnspodToken"
            label="DNSPod Token"
            placeholder="ID,TOKEN"
          />
        </div>

        <div class="setting-section">
          <h4>{{ t('admin.settings.allowedDomains') }}</h4>
          <p class="setting-desc">
            {{ t('admin.settings.allowedDomainsDesc') }}
          </p>
          <textarea
            v-model="allowedDomains"
            class="textarea-field"
            :placeholder="'example.com\n*.example.org'"
            rows="5"
          ></textarea>
        </div>

        <div class="setting-section">
          <h4>{{ t('admin.settings.cloudflareConfig') }}</h4>
          <p class="setting-desc">
            {{ t('admin.settings.cloudflareDesc') }}
          </p>
          <div class="toggle-row">
            <span class="toggle-label">{{ t('admin.settings.enableTurnstile') }}</span>
            <Toggle v-model="turnstileEnabled" />
          </div>
          <InputField
            v-model="turnstileSiteKey"
            :label="t('admin.settings.turnstileSiteKey')"
            placeholder="0xxx..."
          />
          <InputField
            v-model="turnstileSecretKey"
            :label="t('admin.settings.turnstileSecretKey')"
            placeholder="0xxx..."
          />
        </div>

        <div class="setting-section">
          <h4>{{ t('admin.settings.resendConfig') }}</h4>
          <p class="setting-desc">
            {{ t('admin.settings.resendDesc') }}
          </p>
          <div class="toggle-row">
            <span class="toggle-label">{{ t('admin.settings.enableEmail') }}</span>
            <Toggle v-model="emailEnabled" />
          </div>
          <InputField
            v-model="resendApiKey"
            :label="t('admin.settings.resendApiKey')"
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

        <div class="form-actions">
          <Button @click="handleSave" :loading="loading">
            {{ t('common.save') }}
          </Button>
          <span v-if="saved" class="saved-message">{{ t('admin.settings.settingsSaved') }}</span>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 800px;
  margin: 0 auto;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.setting-section h4 {
  font-size: 18px;
  margin-bottom: 12px;
}

.setting-desc {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 20px;
}

.setting-desc code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
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

.form-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.saved-message {
  color: var(--color-accent);
  font-size: 14px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.toggle-label {
  font-size: 14px;
  color: var(--color-text);
}
</style>
