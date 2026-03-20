<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import InputField from '@/components/InputField.vue'
import Button from '@/components/Button.vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')

async function handleLogin() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = '请填写所有字段'
    return
  }
  const success = await authStore.login(email.value, password.value)
  if (success) {
    router.push('/dashboard')
  } else {
    error.value = '邮箱或密码错误'
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
        <h1>域名管理系统</h1>
        <p>管理您的域名资产</p>
      </div>

      <form @submit.prevent="handleLogin" class="auth-form">
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
          placeholder="请输入密码"
        />
        <p v-if="error" class="error">{{ error }}</p>
        <Button type="submit" :loading="authStore.loading">
          登录
        </Button>
      </form>

      <p class="auth-footer">
        还没有账户？ <router-link to="/register">立即注册</router-link>
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
