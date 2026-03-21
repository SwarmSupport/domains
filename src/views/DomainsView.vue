<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDomainStore } from '@/stores/domains'
import { useI18n } from 'vue-i18n'
import { settingApi } from '@/api'
import Card from '@/components/Card.vue'
import Button from '@/components/Button.vue'
import InputField from '@/components/InputField.vue'
import Modal from '@/components/Modal.vue'

const router = useRouter()
const authStore = useAuthStore()
const domainStore = useDomainStore()
const { t } = useI18n()

const showAddModal = ref(false)
const newSubdomain = ref('')
const selectedSuffix = ref('')
const newPurpose = ref('')
const addError = ref('')
const filter = ref<'all' | 'active' | 'pending' | 'rejected' | 'suspended'>('all')
const availableSuffixes = ref<string[]>([])
const isLoading = ref(true)

onMounted(async () => {
  // Wait for auth user to be loaded
  if (!authStore.user) {
    await authStore.fetchUser()
  }
  isLoading.value = false
  await domainStore.fetchDomains()
  // Fetch available domain suffixes
  try {
    const { data } = await settingApi.get('DOMAIN_SUFFIXES')
    if (data.success && data.data?.value) {
      availableSuffixes.value = data.data.value.split('\n').map(s => s.trim()).filter(s => s.length > 0)
    }
  } catch (e) {
    console.error('Failed to load domain suffixes')
  }
})

// Watch for user changes and refetch domains when user is loaded
watch(() => authStore.user, (newUser) => {
  if (newUser) {
    domainStore.fetchDomains()
  }
})

const filteredDomains = computed(() => {
  if (!authStore.user?.id) {
    return []
  }
  const userId = authStore.user.id
  const myDomains = domainStore.domains.filter(d => {
    const domainUserId = d.user_id !== null && d.user_id !== undefined ? Number(d.user_id) : null
    return domainUserId === userId
  })
  if (filter.value === 'all') return myDomains
  return myDomains.filter(d => d.status === filter.value)
})

async function handleAddDomain() {
  addError.value = ''
  if (!selectedSuffix.value) {
    addError.value = t('domains.suffixRequired')
    return
  }
  if (!newSubdomain.value) {
    addError.value = t('domains.enterDomain')
    return
  }
  if (!newPurpose.value || newPurpose.value.trim().length === 0) {
    addError.value = t('domains.purposeRequired')
    return
  }
  // Combine subdomain and suffix (e.g., "mysite" + "example.com" = "mysite.example.com")
  const fullDomain = `${newSubdomain.value}.${selectedSuffix.value}`
  const success = await domainStore.createDomain(fullDomain, newPurpose.value)
  if (success) {
    showAddModal.value = false
    newSubdomain.value = ''
    selectedSuffix.value = ''
    newPurpose.value = ''
  } else {
    addError.value = t('domains.addFailed')
  }
}

async function handleDelete(id: number) {
  if (confirm(t('common.delete') + '?')) {
    await domainStore.deleteDomain(id)
  }
}
</script>

<template>
  <div class="domains-page">
    <div class="page-header">
      <div class="filter-tabs">
        <button :class="['tab', { active: filter === 'all' }]" @click="filter = 'all'">{{ t('domains.all') }}</button>
        <button :class="['tab', { active: filter === 'active' }]" @click="filter = 'active'">{{ t('domains.active') }}</button>
        <button :class="['tab', { active: filter === 'pending' }]" @click="filter = 'pending'">{{ t('domains.pending') }}</button>
        <button :class="['tab', { active: filter === 'rejected' }]" @click="filter = 'rejected'">{{ t('domains.rejected') }}</button>
      </div>
      <Button @click="showAddModal = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('domains.addDomain') }}
      </Button>
    </div>

    <div v-if="isLoading" class="loading">{{ t('common.loading') }}</div>

    <div v-else-if="filteredDomains.length === 0" class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <h3>{{ t('domains.noDomains') }}</h3>
      <p>{{ t('domains.noDomainsDesc') }}</p>
    </div>

    <div v-else class="domains-grid">
      <Card v-for="domain in filteredDomains" :key="domain.id" customClass="domain-card" @click="domain.status === 'active' && router.push(`/dns/${domain.name}`)">
        <div class="domain-header">
          <div class="domain-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <span class="domain-status" :class="domain.status">
            {{ domain.status === 'active' ? t('domains.active') : domain.status === 'pending' ? t('domains.pending') : domain.status === 'rejected' ? t('domains.rejected') : t('domains.suspended') }}
          </span>
        </div>
        <h3 class="domain-name">{{ domain.name }}</h3>
        <p class="domain-meta">{{ t('domains.expiresAt') }}: {{ new Date(domain.expires_at).toLocaleDateString() }}</p>
        <div v-if="domain.purpose" class="domain-purpose">
          <strong>{{ t('domains.purpose') }}:</strong> {{ domain.purpose }}
        </div>
        <div v-if="domain.status === 'rejected' && domain.rejection_reason" class="domain-rejection">
          <strong>{{ t('domains.rejectionReason') }}:</strong> {{ domain.rejection_reason }}
        </div>
        <div class="domain-actions" @click.stop>
          <button class="action-btn danger" @click="handleDelete(domain.id)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </Card>
    </div>

    <Modal v-model:show="showAddModal" :title="t('domains.addDomainTitle')">
      <form @submit.prevent="handleAddDomain" class="add-form">
        <div class="suffix-select">
          <label>{{ t('domains.selectSuffix') }}</label>
          <select v-model="selectedSuffix" class="select-field">
            <option value="" disabled>{{ t('domains.selectSuffix') }}</option>
            <option v-for="suffix in availableSuffixes" :key="suffix" :value="suffix">{{ suffix }}</option>
          </select>
        </div>
        <InputField
          v-model="newSubdomain"
          :label="t('domains.domainName')"
          :placeholder="t('domains.addDomainPlaceholder')"
        />
        <div v-if="selectedSuffix && newSubdomain" class="full-domain-preview">
          <span class="preview-label">{{ t('domains.domainName') }}:</span>
          <span class="preview-value">{{ newSubdomain }}.{{ selectedSuffix }}</span>
        </div>
        <InputField
          v-model="newPurpose"
          :label="t('domains.domainPurpose')"
          :placeholder="t('domains.purposePlaceholder')"
        />
        <p v-if="addError" class="error">{{ addError }}</p>
        <div class="form-actions">
          <Button variant="secondary" type="button" @click="showAddModal = false">{{ t('common.cancel') }}</Button>
          <Button type="submit" :loading="domainStore.loading">{{ t('common.add') }}</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.domains-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  background: var(--color-card);
  padding: 4px;
  border-radius: var(--radius-md);
}

.tab {
  padding: 8px 16px;
  background: none;
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--color-text);
}

.tab.active {
  background: var(--color-secondary);
  color: var(--color-text);
}

.loading {
  text-align: center;
  padding: 60px;
  color: var(--color-text-secondary);
}

.empty-state {
  text-align: center;
  padding: 80px 40px;
  background: var(--color-card);
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 20px;
  margin-bottom: 8px;
  color: var(--color-text);
}

.domains-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.domain-card {
  padding: 24px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.domain-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
}

.domain-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.domain-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(0, 212, 170, 0.1);
  color: var(--color-accent);
  border-radius: var(--radius-md);
}

.domain-status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.domain-status.active {
  background: rgba(0, 212, 170, 0.15);
  color: var(--color-accent);
}

.domain-status.pending {
  background: rgba(255, 171, 64, 0.15);
  color: var(--color-warning);
}

.domain-status.rejected {
  background: rgba(255, 107, 107, 0.15);
  color: var(--color-danger);
}

.domain-status.suspended {
  background: rgba(255, 107, 107, 0.15);
  color: var(--color-danger);
}

.domain-name {
  font-size: 20px;
  margin-bottom: 8px;
  word-break: break-all;
}

.domain-meta {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.domain-purpose {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 212, 170, 0.05);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text-secondary);
}

.domain-rejection {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 107, 107, 0.05);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-danger);
}

.domain-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.action-btn.danger {
  background: rgba(255, 107, 107, 0.1);
  color: var(--color-danger);
}

.action-btn.danger:hover {
  background: rgba(255, 107, 107, 0.2);
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.suffix-select {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suffix-select label {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.select-field {
  padding: 12px 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 14px;
}

.select-field:focus {
  outline: none;
  border-color: var(--color-accent);
}

.full-domain-preview {
  padding: 12px 16px;
  background: rgba(0, 212, 170, 0.1);
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.preview-label {
  color: var(--color-text-secondary);
  margin-right: 8px;
}

.preview-value {
  color: var(--color-accent);
  font-weight: 500;
}

.error {
  color: var(--color-danger);
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>
