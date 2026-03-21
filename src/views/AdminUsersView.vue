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

// Add User Modal
const showAddModal = ref(false)
const newUsername = ref('')
const newEmail = ref('')
const newPassword = ref('')
const newRole = ref<'user' | 'admin'>('user')
const addError = ref('')
const addLoading = ref(false)

// Edit User Modal
const showEditModal = ref(false)
const editingUser = ref<User | null>(null)
const editEmail = ref('')
const editRole = ref<'user' | 'admin'>('user')
const editError = ref('')
const editLoading = ref(false)

// Password Modal
const showPasswordModal = ref(false)
const passwordUserId = ref<number | null>(null)
const passwordUserName = ref('')
const newPasswordValue = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordLoading = ref(false)
const passwordSuccess = ref(false)

onMounted(() => {
  userStore.fetchUsers()
})

// Add User
function openAddModal() {
  newUsername.value = ''
  newEmail.value = ''
  newPassword.value = ''
  newRole.value = 'user'
  addError.value = ''
  showAddModal.value = true
}

async function handleAddUser() {
  addError.value = ''

  if (!newUsername.value || !newEmail.value || !newPassword.value) {
    addError.value = t('auth.fillAllFields')
    return
  }

  if (newUsername.value.length < 3 || newUsername.value.length > 20) {
    addError.value = t('auth.usernameLength')
    return
  }

  if (newPassword.value.length < 6) {
    addError.value = t('auth.passwordTooShort')
    return
  }

  addLoading.value = true
  const result = await userStore.createUser({
    username: newUsername.value,
    email: newEmail.value,
    password: newPassword.value,
    role: newRole.value
  })
  addLoading.value = false

  if (result.success) {
    showAddModal.value = false
  } else {
    addError.value = result.error || t('admin.users.addFailed')
  }
}

// Edit User
function openEditModal(user: User) {
  editingUser.value = user
  editEmail.value = user.email
  editRole.value = user.role
  editError.value = ''
  showEditModal.value = true
}

async function handleUpdateUser() {
  if (!editingUser.value) return

  editError.value = ''

  // Validate email if changed
  if (editEmail.value !== editingUser.value.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editEmail.value)) {
      editError.value = t('auth.invalidEmail')
      return
    }
  }

  // Only update if something changed
  if (editEmail.value === editingUser.value.email && editRole.value === editingUser.value.role) {
    editError.value = t('admin.settings.noChanges')
    return
  }

  editLoading.value = true
  const success = await userStore.updateUser(editingUser.value.id, {
    email: editEmail.value !== editingUser.value.email ? editEmail.value : undefined,
    role: editRole.value !== editingUser.value.role ? editRole.value : undefined
  } as Partial<User>)
  editLoading.value = false

  if (success) {
    showEditModal.value = false
    await userStore.fetchUsers()
  } else {
    editError.value = t('admin.users.updateFailed')
  }
}

// Reset Password
function openPasswordModal(user: User) {
  passwordUserId.value = user.id
  passwordUserName.value = user.username
  newPasswordValue.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSuccess.value = false
  showPasswordModal.value = true
}

async function handleResetPassword() {
  passwordError.value = ''

  if (!newPasswordValue.value || newPasswordValue.value.length < 6) {
    passwordError.value = t('auth.passwordTooShort')
    return
  }

  if (newPasswordValue.value !== confirmPassword.value) {
    passwordError.value = t('auth.passwordMismatch')
    return
  }

  if (!passwordUserId.value) return

  passwordLoading.value = true
  const success = await userStore.updatePassword(passwordUserId.value, newPasswordValue.value)
  passwordLoading.value = false

  if (success) {
    passwordSuccess.value = true
    setTimeout(() => {
      showPasswordModal.value = false
    }, 1500)
  } else {
    passwordError.value = t('admin.users.resetPasswordFailed')
  }
}

// Delete User
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
    <div class="page-header">
      <h2 class="page-title">{{ t('admin.users.title') }}</h2>
      <Button @click="openAddModal">
        {{ t('admin.users.addUser') }}
      </Button>
    </div>

    <Card>
      <div v-if="userStore.loading && userStore.users.length === 0" class="loading">
        {{ t('common.loading') }}
      </div>
      <div v-else-if="userStore.error && userStore.users.length === 0" class="error-state">
        <p>{{ userStore.error }}</p>
        <Button @click="userStore.fetchUsers()">{{ t('common.retry') }}</Button>
      </div>
      <div v-else-if="userStore.users.length === 0" class="empty-state">
        <p>{{ t('admin.users.noUsers') }}</p>
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
                {{ t('admin.users.resetPassword') }}
              </Button>
              <Button
                size="sm"
                variant="danger"
                @click="handleDeleteUser(user.id)"
                :disabled="user.id === authStore.user?.id"
              >
                {{ t('common.delete') }}
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <!-- Add User Modal -->
    <Modal v-model:show="showAddModal" :title="t('admin.users.addUser')">
      <div class="modal-form">
        <InputField
          v-model="newUsername"
          :label="t('admin.users.username')"
          :placeholder="t('auth.usernamePlaceholder')"
        />
        <InputField
          v-model="newEmail"
          :label="t('auth.email')"
          type="email"
          :placeholder="t('auth.emailPlaceholder')"
        />
        <InputField
          v-model="newPassword"
          type="password"
          :label="t('auth.password')"
          :placeholder="t('auth.passwordPlaceholder')"
        />
        <div class="role-select">
          <label>{{ t('admin.users.role') }}</label>
          <select v-model="newRole">
            <option value="user">{{ t('admin.users.user') }}</option>
            <option value="admin">{{ t('admin.users.admin') }}</option>
          </select>
        </div>
        <p v-if="addError" class="error-text">{{ addError }}</p>
        <div class="form-actions">
          <Button variant="secondary" @click="showAddModal = false">{{ t('common.cancel') }}</Button>
          <Button @click="handleAddUser" :loading="addLoading">{{ t('common.add') }}</Button>
        </div>
      </div>
    </Modal>

    <!-- Edit User Modal -->
    <Modal v-model:show="showEditModal" :title="t('admin.users.editUser')">
      <div class="modal-form">
        <div class="edit-info">
          <strong>{{ editingUser?.username }}</strong>
        </div>
        <InputField
          v-model="editEmail"
          :label="t('auth.email')"
          type="email"
          :placeholder="t('auth.emailPlaceholder')"
        />
        <div class="role-select">
          <label>{{ t('admin.users.role') }}</label>
          <select v-model="editRole">
            <option value="user">{{ t('admin.users.user') }}</option>
            <option value="admin">{{ t('admin.users.admin') }}</option>
          </select>
        </div>
        <p v-if="editError" class="error-text">{{ editError }}</p>
        <div class="form-actions">
          <Button variant="secondary" @click="showEditModal = false">{{ t('common.cancel') }}</Button>
          <Button @click="handleUpdateUser" :loading="editLoading">{{ t('common.save') }}</Button>
        </div>
      </div>
    </Modal>

    <!-- Password Reset Modal -->
    <Modal v-model:show="showPasswordModal" :title="t('admin.users.resetPassword')">
      <div class="modal-form">
        <p class="edit-info">
          {{ t('admin.users.resetPasswordFor') }}: <strong>{{ passwordUserName }}</strong>
        </p>
        <InputField
          v-model="newPasswordValue"
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
        <p v-if="passwordError" class="error-text">{{ passwordError }}</p>
        <p v-if="passwordSuccess" class="success-text">{{ t('admin.users.resetPasswordSuccess') }}</p>
        <div class="form-actions">
          <Button variant="secondary" @click="showPasswordModal = false" :disabled="passwordSuccess">
            {{ t('common.cancel') }}
          </Button>
          <Button @click="handleResetPassword" :loading="passwordLoading" :disabled="passwordSuccess">
            {{ t('common.save') }}
          </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.admin-users {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  margin: 0;
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

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.edit-info {
  color: var(--color-text-secondary);
  font-size: 14px;
  padding: 12px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
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

.role-select select:focus {
  outline: none;
  border-color: var(--color-accent);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.error-text {
  color: var(--color-danger);
  font-size: 14px;
  margin: 0;
}

.success-text {
  color: var(--color-accent);
  font-size: 14px;
  margin: 0;
}
</style>
