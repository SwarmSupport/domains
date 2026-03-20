<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/users'
import Card from '@/components/Card.vue'
import Button from '@/components/Button.vue'
import Modal from '@/components/Modal.vue'
import type { User } from '@/types'

const userStore = useUserStore()

const showEditModal = ref(false)
const editingUser = ref<User | null>(null)
const selectedRole = ref<'user' | 'admin'>('user')

onMounted(() => {
  userStore.fetchUsers()
})

function openEditModal(user: User) {
  editingUser.value = user
  selectedRole.value = user.role
  showEditModal.value = true
}

async function handleUpdateRole() {
  if (!editingUser.value) return
  const success = await userStore.updateUser(editingUser.value.id, { role: selectedRole.value })
  if (success) {
    showEditModal.value = false
    editingUser.value = null
  }
}

async function handleDeleteUser(id: number) {
  if (confirm('确定要删除这个用户吗？')) {
    await userStore.deleteUser(id)
  }
}
</script>

<template>
  <div class="admin-users">
    <Card>
      <template #header>
        <h3>用户列表</h3>
      </template>

      <div v-if="userStore.loading" class="loading">加载中...</div>
      <div v-else-if="userStore.users.length === 0" class="empty-state">
        <p>暂无用户</p>
      </div>
      <table v-else class="users-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>注册时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in userStore.users" :key="user.id">
            <td>{{ user.id }}</td>
            <td class="username-cell">{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td>
              <span class="role-badge" :class="user.role">
                {{ user.role === 'admin' ? '管理员' : '用户' }}
              </span>
            </td>
            <td>{{ new Date(user.created_at).toLocaleDateString() }}</td>
            <td class="actions-cell">
              <Button size="sm" variant="secondary" @click="openEditModal(user)">
                编辑
              </Button>
              <Button size="sm" variant="danger" @click="handleDeleteUser(user.id)">
                删除
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <Modal v-model:show="showEditModal" title="编辑用户">
      <div class="edit-form">
        <p class="edit-info">正在编辑用户: <strong>{{ editingUser?.username }}</strong></p>
        <div class="role-select">
          <label>角色</label>
          <select v-model="selectedRole">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <div class="form-actions">
          <Button variant="secondary" @click="showEditModal = false">取消</Button>
          <Button @click="handleUpdateRole">保存</Button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.admin-users {
  max-width: 1200px;
  margin: 0 auto;
}

.loading, .empty-state {
  text-align: center;
  padding: 60px;
  color: var(--color-text-secondary);
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.users-table th {
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: 14px;
  text-transform: uppercase;
}

.users-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.username-cell {
  font-weight: 500;
}

.role-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.role-badge.admin {
  background: rgba(0, 212, 170, 0.15);
  color: var(--color-accent);
}

.role-badge.user {
  background: rgba(139, 163, 185, 0.15);
  color: var(--color-text-secondary);
}

.actions-cell {
  display: flex;
  gap: 8px;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.edit-info {
  color: var(--color-text-secondary);
}

.edit-info strong {
  color: var(--color-text);
}

.role-select {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.role-select label {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.role-select select {
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
