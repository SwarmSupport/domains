<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDomainStore } from '@/stores/domains'
import { useI18n } from 'vue-i18n'
import Card from '@/components/Card.vue'

const router = useRouter()
const authStore = useAuthStore()
const domainStore = useDomainStore()
const { t } = useI18n()

onMounted(() => {
  domainStore.fetchDomains()
})

const stats = computed(() => {
  const domains = domainStore.domains
  const myDomains = domains.filter(d => d.user_id === authStore.user?.id)
  return {
    totalDomains: domains.length,
    myDomains: myDomains.length,
    activeDomains: myDomains.filter(d => d.status === 'active').length,
    pendingDomains: domains.filter(d => d.status === 'pending').length
  }
})

const recentDomains = computed(() => {
  return domainStore.domains.filter(d => d.user_id === authStore.user?.id).slice(0, 5)
})
</script>

<template>
  <div class="dashboard">
    <div class="welcome">
      <h1>{{ t('dashboard.welcome') }}, {{ authStore.user?.username }}</h1>
      <p>{{ t('dashboard.welcome') }}</p>
    </div>

    <div class="stats-grid">
      <Card customClass="stat-card">
        <div class="stat-icon blue">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.myDomains }}</span>
          <span class="stat-label">{{ t('nav.myDomains') }}</span>
        </div>
      </Card>

      <Card customClass="stat-card">
        <div class="stat-icon green">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.activeDomains }}</span>
          <span class="stat-label">{{ t('domains.active') }}</span>
        </div>
      </Card>

      <Card customClass="stat-card">
        <div class="stat-icon yellow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.pendingDomains }}</span>
          <span class="stat-label">{{ t('domains.pending') }}</span>
        </div>
      </Card>

      <Card v-if="authStore.isAdmin" customClass="stat-card">
        <div class="stat-icon purple">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.totalDomains }}</span>
          <span class="stat-label">{{ t('dashboard.totalDomains') }}</span>
        </div>
      </Card>
    </div>

    <Card customClass="recent-card">
      <template #header>
        <h3>{{ t('dashboard.recentActivity') }}</h3>
        <router-link to="/domains" class="view-all">{{ t('domains.all') }}</router-link>
      </template>
      <div class="domain-list">
        <div v-if="recentDomains.length === 0" class="empty-state">
          <p>{{ t('domains.noDomains') }}</p>
          <router-link to="/domains" class="link">{{ t('domains.addDomain') }}</router-link>
        </div>
        <div v-for="domain in recentDomains" :key="domain.id" class="domain-item" @click="router.push(`/dns/${domain.name}`)">
          <div class="domain-info">
            <span class="domain-name">{{ domain.name }}</span>
            <span class="domain-status" :class="domain.status">{{ domain.status === 'active' ? t('domains.active') : domain.status === 'pending' ? t('domains.pending') : t('domains.suspended') }}</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.welcome {
  margin-bottom: 32px;
}

.welcome h1 {
  font-size: 28px;
  margin-bottom: 8px;
}

.welcome p {
  color: var(--color-text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.stat-icon.blue {
  background: rgba(45, 90, 135, 0.2);
  color: #5b9bd5;
}

.stat-icon.green {
  background: rgba(0, 212, 170, 0.15);
  color: var(--color-accent);
}

.stat-icon.yellow {
  background: rgba(255, 171, 64, 0.15);
  color: var(--color-warning);
}

.stat-icon.purple {
  background: rgba(156, 39, 176, 0.15);
  color: #ce93d8;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  color: var(--color-text-secondary);
  font-size: 14px;
  margin-top: 4px;
}

.recent-card :deep(.card-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.recent-card :deep(.card-header h3) {
  font-size: 18px;
}

.view-all {
  font-size: 14px;
}

.domain-list {
  display: flex;
  flex-direction: column;
}

.domain-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.domain-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.domain-item + .domain-item {
  border-top: 1px solid var(--color-border);
}

.domain-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.domain-name {
  font-weight: 500;
}

.domain-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
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

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

.link {
  display: inline-block;
  margin-top: 8px;
}
</style>
