<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDomainStore } from '@/stores/domains'
import { useUserStore } from '@/stores/users'
import Card from '@/components/Card.vue'
import Button from '@/components/Button.vue'
import Modal from '@/components/Modal.vue'

const domainStore = useDomainStore()
const userStore = useUserStore()

const showAssignModal = ref(false)
const selectedDomainId = ref<number | null>(null)
const selectedUserId = ref<number | null>(null)

onMounted(() => {
  domainStore.fetchDomains()
  userStore.fetchUsers()
})

const pendingDomains = computed(() => domainStore.domains.filter(d => d.status === 'pending'))
const assignedDomains = computed(() => domainStore.domains.filter(d => d.status === 'active'))

function openAssignModal(domainId: number) {
  selectedDomainId.value = domainId
  selectedUserId.value = null
  showAssignModal.value = true
}

async function handleAssign() {
  if (!selectedDomainId.value || !selectedUserId.value) return
  const success = await domainStore.assignDomain(selectedDomainId.value, selectedUserId.value)
  if (success) {
    showAssignModal.value = false
    selectedDomainId.value = null
    selectedUserId.value = null
  }
}

async function handleDelete(id: number) {
  if (confirm('确定要删除这个域名吗？')) {
    await domainStore.deleteDomain(id)
  }
}

function getUsername(userId: number | null) {
  if (!userId) return '未分配'
  const user = userStore.users.find(u => u.id === userId)
  return user?.username || '未知'
}
</script>

<template>
  <div class="admin-domains">
    <Card>
      <template #header>
        <h3>待审核域名 ({{ pendingDomains.length }})</h3>
      </template>

      <div v-if="pendingDomains.length === 0" class="empty-state">
        <p>暂无待审核域名</p>
      </div>
      <table v-else class="domains-table">
        <thead>
          <tr>
            <th>域名</th>
            <th>申请时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="domain in pendingDomains" :key="domain.id">
            <td class="domain-name">{{ domain.name }}</td>
            <td>{{ new Date(domain.created_at).toLocaleDateString() }}</td>
            <td class="actions-cell">
              <Button size="sm" @click="openAssignModal(domain.id)">分配</Button>
              <Button size="sm" variant="danger" @click="handleDelete(domain.id)">删除</Button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <Card customClass="mt-4">
      <template #header>
        <h3>已分配域名 ({{ assignedDomains.length }})</h3>
      </template>

      <div v-if="assignedDomains.length === 0" class="empty-state">
        <p>暂无已分配域名</p>
      </div>
      <table v-else class="domains-table">
        <thead>
          <tr>
            <th>域名</th>
            <th>所有者</th>
            <th>到期时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="domain in assignedDomains" :key="domain.id">
            <td class="domain-name">{{ domain.name }}</td>
            <td>{{ getUsername(domain.user_id) }}</td>
            <td>{{ new Date(domain.expires_at).toLocaleDateString() }}</td>
            <td class="actions-cell">
              <Button size="sm" variant="danger" @click="handleDelete(domain.id)">删除</Button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <Modal v-model:show="showAssignModal" title="分配域名">
      <div class="assign-form">
        <p>请选择要将域名分配给的用户</p>
        <div class="user-select">
          <select v-model="selectedUserId">
            <option :value="null" disabled>选择用户...</option>
            <option v-for="user in userStore.users" :key="user.id" :value="user.id">
              {{ user.username }} ({{ user.email }})
            </option>
          </select>
        </div>
        <div class="form-actions">
          <Button variant="secondary" @click="showAssignModal = false">取消</Button>
          <Button @click="handleAssign" :disabled="!selectedUserId">确认分配</Button>
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
