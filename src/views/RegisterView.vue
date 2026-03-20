<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import InputField from '@/components/InputField.vue'
import Button from '@/components/Button.vue'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')

async function handleRegister() {
  error.value = ''

  if (!username.value || !email.value || !password.value || !confirmPassword.value) {
    error.value = '请填写所有字段'
    return
  }

  if (username.value.length < 3 || username.value.length > 20) {
    error.value = '用户名需要 3-20 个字符'
    return
  }

  if (password.value.length < 6) {
    error.value = '密码至少需要 6 个字符'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = '两次密码输入不一致'
    return
  }

  const success = await authStore.register(username.value, email.value, password.value)
  if (success) {
    router.push('/dashboard')
  } else {
    error.value = '注册失败，请稍后重试'
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <div class="logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <h1>创建账户</h1>
        <p>开始管理您的域名</p>
      </div>

      <form @submit.prevent="handleRegister" class="auth-form">
        <InputField
          v-model="username"
          label="用户名"
          placeholder="请输入用户名 (3-20字符)"
        />
        <InputField
          v-model="email"
          type="email"
          label="邮箱"
          placeholder="请输入邮箱"
        />
        <InputField
          v-model="password"
          type="password"
          label="密码"
          placeholder="请输入密码 (至少6字符)"
        />
        <InputField
          v-model="confirmPassword"
          type="password"
          label="确认密码"
          placeholder="请再次输入密码"
        />
        <p v-if="error" class="error">{{ error }}</p>
        <Button type="submit" :loading="authStore.loading">
          注册
        </Button>
      </form>

      <p class="auth-footer">
        已有账户？ <router-link to="/login">立即登录</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, var(--color-bg) 0%, var(--color-primary) 100%);
}

.auth-container {
  width: 100%;
  max-width: 400px;
  padding: 48px;
  background: var(--color-card);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow);
}

.auth-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--color-accent), var(--color-secondary));
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
  color: white;
}

.auth-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.auth-header p {
  color: var(--color-text-secondary);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.error {
  color: var(--color-danger);
  font-size: 14px;
  text-align: center;
}

.auth-footer {
  text-align: center;
  margin-top: 24px;
  color: var(--color-text-secondary);
}
</style>
