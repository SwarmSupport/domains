<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import Card from '@/components/Card.vue'
import Button from '@/components/Button.vue'
import Modal from '@/components/Modal.vue'
import InputField from '@/components/InputField.vue'
import type { User } from '@/types'

const userStore = useUserStore()
const authStore = useAuthStore()
const { t } = useI18n()

const showEditModal = ref(false)
const showPasswordModal = ref(false)
const editingUser = ref<User | null>(null)
const selectedRole = ref<'user' | 'admin'>('user')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref(false)

onMounted(() => {
  userStore.fetchUsers()
})

function openEditModal(user: User) {
  editingUser.value = user
  selectedRole.value = user.role
  showEditModal.value = true
}

function openPasswordModal(user: User) {
  editingUser.value = user
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSuccess.value = false
  showPasswordModal.value = true
}

async function handleUpdateRole() {
  if (!editingUser.value) return
  const success = await userStore.updateUser(editingUser.value.id, { role: selectedRole.value })
  if (success) {
    showEditModal.value = false
    editingUser.value = null
  }
}

async function handleUpdatePassword() {
  passwordError.value = ''
  passwordSuccess.value = false

  if (!newPassword.value || newPassword.value.length < 6) {
    passwordError.value = t('auth.passwordTooShort')
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = t('auth.passwordMismatch')
    return
  }

  if (!editingUser.value) return

  const success = await userStore.updatePassword(editingUser.value.id, newPassword.value)
  if (success) {
    passwordSuccess.value = true
    setTimeout(() => {
      showPasswordModal.value = false
      newPassword.value = ''
      confirmPassword.value = ''
    }, 1500)
  } else {
    passwordError.value = t('admin.users.passwordChangeFailed')
  }
}

async function handleDeleteUser(id: number) {
  if (id === authStore.user?.id) {
    alert(t('admin.users.cannotDeleteSelf'))
    return
  }
  if (confirm(t('admin.users.deleteConfirm'))) {
    await userStore.deleteUser(id)
  }
}
</script>

<template>
  <div class="admin-users">
    <Card>
      <template #header>
        <h3>{{ t('admin.users.title') }}</h3>
      </template>

      <div v-if="userStore.loading" class="loading">{{ t('common.loading') }}</div>
      <div v-else-if="userStore.error" class="error-state">
        <p>{{ userStore.error }}</p>
        <Button @click="userStore.fetchUsers()">{{ t('common.retry') || 'Retry' }}</Button>
      </div>
      <div v-else-if="userStore.users.length === 0" class="empty-state">
        <p>-</p>
      </div>
      <table v-else class="users-table">
        <thead>
          <tr>
            <th>{{ t('admin.users.id') }}</th>
            <th>{{ t('admin.users.username') }}</th>
            <th>{{ t('admin.users.email') }}</th>
            <th>{{ t('admin.users.role') }}</th>
            <th>{{ t('admin.users.createdAt') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in userStore.users" :key="user.id">
            <td>{{ user.id }}</td>
            <td class="username-cell">{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td>
              <span class="role-badge" :class="user.role">
                {{ user.role === 'admin' ? t('admin.users.admin') : t('admin.users.user') }}
              </span>
            </td>
            <td>{{ new Date(user.created_at).toLocaleDateString() }}</td>
            <td class="actions-cell">
              <Button size="sm" variant="secondary" @click="openEditModal(user)">
                {{ t('common.edit') }}
              </Button>
              <Button size="sm" variant="secondary" @click="openPasswordModal(user)">
                {{ t('admin.users.changePassword') }}
              </Button>
              <Button size="sm" variant="danger" @click="handleDeleteUser(user.id)" :disabled="user.id === authStore.user?.id">
                {{ t('common.delete') }}
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <Modal v-model:show="showEditModal" :title="t('admin.users.changeRole')">
      <div class="edit-form">
        <p class="edit-info">{{ t('common.edit') }}: <strong>{{ editingUser?.username }}</strong></p>
        <div class="role-select">
          <label>{{ t('admin.users.role') }}</label>
          <select v-model="selectedRole">
            <option value="user">{{ t('admin.users.user') }}</option>
            <option value="admin">{{ t('admin.users.admin') }}</option>
          </select>
        </div>
        <div class="form-actions">
          <Button variant="secondary" @click="showEditModal = false">{{ t('common.cancel') }}</Button>
          <Button @click="handleUpdateRole">{{ t('common.save') }}</Button>
        </div>
      </div>
    </Modal>

    <Modal v-model:show="showPasswordModal" :title="t('admin.users.changePassword')">
      <div class="edit-form">
        <p class="edit-info">{{ t('admin.users.changePassword') }}: <strong>{{ editingUser?.username }}</strong></p>
        <InputField
          v-model="newPassword"
          type="password"
          :label="t('admin.users.newPassword')"
          :placeholder="t('auth.passwordPlaceholder')"
        />
        <InputField
          v-model="confirmPassword"
          type="password"
          :label="t('admin.users.confirmNewPassword')"
          :placeholder="t('auth.confirmPasswordPlaceholder')"
        />
        <p v-if="passwordError" class="error">{{ passwordError }}</p>
        <p v-if="passwordSuccess" class="success">{{ t('admin.users.passwordChanged') }}</p>
        <div class="form-actions">
          <Button variant="secondary" @click="showPasswordModal = false">{{ t('common.cancel') }}</Button>
          <Button @click="handleUpdatePassword" :disabled="passwordSuccess">{{ t('common.save') }}</Button>
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

.loading, .empty-state, .error-state {
  text-align: center;
  padding: 60px;
  color: var(--color-text-secondary);
}

.error-state {
  color: var(--color-danger);
}

.error-state p {
  margin-bottom: 16px;
}

.success {
  color: var(--color-accent);
  font-size: 14px;
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
