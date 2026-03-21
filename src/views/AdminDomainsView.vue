<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDomainStore } from '@/stores/domains'
import { useUserStore } from '@/stores/users'
import { useI18n } from 'vue-i18n'
import Card from '@/components/Card.vue'
import Button from '@/components/Button.vue'
import Modal from '@/components/Modal.vue'
import InputField from '@/components/InputField.vue'

const domainStore = useDomainStore()
const userStore = useUserStore()
const { t } = useI18n()

const showApproveModal = ref(false)
const showRejectModal = ref(false)
const selectedDomainId = ref<number | null>(null)
const selectedUserId = ref<number | null>(null)
const rejectReason = ref('')

onMounted(() => {
  domainStore.fetchDomains()
  userStore.fetchUsers()
})

const pendingDomains = computed(() => domainStore.domains.filter(d => d.status === 'pending'))
const assignedDomains = computed(() => domainStore.domains.filter(d => d.status === 'active'))

function openApproveModal(domainId: number) {
  selectedDomainId.value = domainId
  selectedUserId.value = null
  showApproveModal.value = true
}

function openRejectModal(domainId: number) {
  selectedDomainId.value = domainId
  rejectReason.value = ''
  showRejectModal.value = true
}

async function handleApprove() {
  if (!selectedDomainId.value || !selectedUserId.value) return
  const success = await domainStore.approveDomain(selectedDomainId.value, selectedUserId.value)
  if (success) {
    showApproveModal.value = false
    selectedDomainId.value = null
    selectedUserId.value = null
  }
}

async function handleReject() {
  if (!selectedDomainId.value) return
  const success = await domainStore.rejectDomain(selectedDomainId.value, rejectReason.value)
  if (success) {
    showRejectModal.value = false
    selectedDomainId.value = null
    rejectReason.value = ''
  }
}

async function handleDelete(id: number) {
  if (confirm(t('common.delete') + '?')) {
    await domainStore.deleteDomain(id)
  }
}

function getUsername(userId: number | null) {
  if (!userId) return '-'
  const user = userStore.users.find(u => u.id === userId)
  return user?.username || '-'
}
</script>

<template>
  <div class="admin-domains">
    <Card>
      <template #header>
        <h3>{{ t('admin.domains.pendingDomains') }} ({{ pendingDomains.length }})</h3>
      </template>

      <div v-if="pendingDomains.length === 0" class="empty-state">
        <p>{{ t('admin.domains.noPendingDomains') }}</p>
      </div>
      <table v-else class="domains-table">
        <thead>
          <tr>
            <th>{{ t('domains.domainName') }}</th>
            <th>{{ t('admin.domains.purpose') }}</th>
            <th>{{ t('admin.domains.applicant') }}</th>
            <th>{{ t('admin.domains.appliedAt') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="domain in pendingDomains" :key="domain.id">
            <td class="domain-name">{{ domain.name }}</td>
            <td>{{ domain.purpose || '-' }}</td>
            <td>{{ getUsername(domain.user_id) }}</td>
            <td>{{ new Date(domain.created_at).toLocaleDateString() }}</td>
            <td class="actions-cell">
              <Button size="sm" @click="openApproveModal(domain.id)">{{ t('domains.approve') }}</Button>
              <Button size="sm" variant="secondary" @click="openRejectModal(domain.id)">{{ t('domains.reject') }}</Button>
              <Button size="sm" variant="danger" @click="handleDelete(domain.id)">{{ t('common.delete') }}</Button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <Card customClass="mt-4">
      <template #header>
        <h3>{{ t('admin.domains.assignedDomains') }} ({{ assignedDomains.length }})</h3>
      </template>

      <div v-if="assignedDomains.length === 0" class="empty-state">
        <p>{{ t('admin.domains.noAssignedDomains') }}</p>
      </div>
      <table v-else class="domains-table">
        <thead>
          <tr>
            <th>{{ t('domains.domainName') }}</th>
            <th>{{ t('admin.domains.applicant') }}</th>
            <th>{{ t('domains.expiresAt') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="domain in assignedDomains" :key="domain.id">
            <td class="domain-name">{{ domain.name }}</td>
            <td>{{ getUsername(domain.user_id) }}</td>
            <td>{{ new Date(domain.expires_at).toLocaleDateString() }}</td>
            <td class="actions-cell">
              <Button size="sm" variant="danger" @click="handleDelete(domain.id)">{{ t('common.delete') }}</Button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <Modal v-model:show="showApproveModal" :title="t('admin.domains.assignDomain')">
      <div class="assign-form">
        <p>{{ t('admin.domains.selectUser') }}</p>
        <div class="user-select">
          <select v-model="selectedUserId">
            <option :value="null" disabled>{{ t('admin.domains.selectUser') }}...</option>
            <option v-for="user in userStore.users" :key="user.id" :value="user.id">
              {{ user.username }} ({{ user.email }})
            </option>
          </select>
        </div>
        <div class="form-actions">
          <Button variant="secondary" @click="showApproveModal = false">{{ t('common.cancel') }}</Button>
          <Button @click="handleApprove" :disabled="!selectedUserId">{{ t('domains.approve') }}</Button>
        </div>
      </div>
    </Modal>

    <Modal v-model:show="showRejectModal" :title="t('domains.reject')">
      <div class="reject-form">
        <InputField
          v-model="rejectReason"
          :label="t('domains.rejectionReason')"
          :placeholder="t('domains.enterRejectionReason')"
        />
        <div class="form-actions">
          <Button variant="secondary" @click="showRejectModal = false">{{ t('common.cancel') }}</Button>
          <Button variant="danger" @click="handleReject">{{ t('domains.reject') }}</Button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.admin-domains {
  max-width: 1200px;
  margin: 0 auto;
}

.mt-4 {
  margin-top: 24px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

.domains-table {
  width: 100%;
  border-collapse: collapse;
}

.domains-table th,
.domains-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.domains-table th {
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: 14px;
  text-transform: uppercase;
}

.domains-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.domain-name {
  font-weight: 500;
}

.actions-cell {
  display: flex;
  gap: 8px;
}

.assign-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.assign-form p {
  color: var(--color-text-secondary);
}

.user-select select {
  width: 100%;
  padding: 12px 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 14px;
}

.reject-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
