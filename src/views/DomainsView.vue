<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDomainStore } from '@/stores/domains'
import Card from '@/components/Card.vue'
import Button from '@/components/Button.vue'
import InputField from '@/components/InputField.vue'
import Modal from '@/components/Modal.vue'

const router = useRouter()
const authStore = useAuthStore()
const domainStore = useDomainStore()

const showAddModal = ref(false)
const newDomain = ref('')
const addError = ref('')
const filter = ref<'all' | 'active' | 'pending'>('all')

onMounted(() => {
  domainStore.fetchDomains()
})

const filteredDomains = computed(() => {
  const myDomains = domainStore.domains.filter(d => d.user_id === authStore.user?.id)
  if (filter.value === 'all') return myDomains
  return myDomains.filter(d => d.status === filter.value)
})

async function handleAddDomain() {
  addError.value = ''
  if (!newDomain.value) {
    addError.value = '请输入域名'
    return
  }
  const success = await domainStore.createDomain(newDomain.value)
  if (success) {
    showAddModal.value = false
    newDomain.value = ''
  } else {
    addError.value = '添加失败，请稍后重试'
  }
}

async function handleDelete(id: number) {
  if (confirm('确定要删除这个域名吗？')) {
    await domainStore.deleteDomain(id)
  }
}
</script>

<template>
  <div class="domains-page">
    <div class="page-header">
      <div class="filter-tabs">
        <button :class="['tab', { active: filter === 'all' }]" @click="filter = 'all'">全部</button>
        <button :class="['tab', { active: filter === 'active' }]" @click="filter = 'active'">已解析</button>
        <button :class="['tab', { active: filter === 'pending' }]" @click="filter = 'pending'">待审核</button>
      </div>
      <Button @click="showAddModal = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        添加域名
      </Button>
    </div>

    <div v-if="domainStore.loading" class="loading">加载中...</div>

    <div v-else-if="filteredDomains.length === 0" class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <h3>暂无域名</h3>
      <p>点击上方按钮添加您的第一个域名</p>
    </div>

    <div v-else class="domains-grid">
      <Card v-for="domain in filteredDomains" :key="domain.id" customClass="domain-card" @click="router.push(`/dns/${domain.name}`)">
        <div class="domain-header">
          <div class="domain-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <span class="domain-status" :class="domain.status">
            {{ domain.status === 'active' ? '已解析' : domain.status === 'pending' ? '待审核' : '已暂停' }}
          </span>
        </div>
        <h3 class="domain-name">{{ domain.name }}</h3>
        <p class="domain-meta">到期时间: {{ new Date(domain.expires_at).toLocaleDateString() }}</p>
        <div class="domain-actions" @click.stop>
          <button class="action-btn danger" @click="handleDelete(domain.id)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </Card>
    </div>

    <Modal v-model:show="showAddModal" title="添加域名">
      <form @submit.prevent="handleAddDomain" class="add-form">
        <InputField
          v-model="newDomain"
          label="域名"
          placeholder="例如: example.com"
        />
        <p v-if="addError" class="error">{{ addError }}</p>
        <div class="form-actions">
          <Button variant="secondary" type="button" @click="showAddModal = false">取消</Button>
          <Button type="submit" :loading="domainStore.loading">添加</Button>
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
