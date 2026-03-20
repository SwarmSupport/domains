<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { settingApi } from '@/api'
import Card from '@/components/Card.vue'
import InputField from '@/components/InputField.vue'
import Button from '@/components/Button.vue'

const dnspodToken = ref('')
const loading = ref(false)
const saved = ref(false)

onMounted(async () => {
  try {
    const { data } = await settingApi.get('DNSPOD_TOKEN')
    if (data.success && data.data) {
      dnspodToken.value = data.data.value
    }
  } catch (e) {
    console.error('Failed to load settings')
  }
})

async function handleSave() {
  loading.value = true
  saved.value = false
  try {
    await settingApi.set('DNSPOD_TOKEN', dnspodToken.value)
    saved.value = true
    setTimeout(() => saved.value = false, 3000)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <Card>
      <template #header>
        <h3>系统设置</h3>
      </template>

      <div class="settings-form">
        <div class="setting-section">
          <h4>DNSPod 配置</h4>
          <p class="setting-desc">
            在 DNSPod 创建 Token 并填入下方输入框。<br>
            Token 格式: <code>ID,TOKEN</code> (在 DNSPod 控制台创建)
          </p>
          <InputField
            v-model="dnspodToken"
            label="DNSPod Token"
            placeholder="请输入您的 DNSPod Token"
          />
        </div>

        <div class="form-actions">
          <Button @click="handleSave" :loading="loading">
            保存设置
          </Button>
          <span v-if="saved" class="saved-message">设置已保存</span>
        </div>
      </div>
    </Card>

    <Card customClass="mt-4">
      <template #header>
        <h3>使用说明</h3>
      </template>

      <div class="help-content">
        <div class="help-item">
          <h5>1. 获取 DNSPod Token</h5>
          <ol>
            <li>登录 DNSPod 控制台</li>
            <li>进入 "用户中心" -> "API 密钥"</li>
            <li>创建新的 Token，格式为 <code>ID,TOKEN</code></li>
            <li>将 Token 填入上方设置</li>
          </ol>
        </div>
        <div class="help-item">
          <h5>2. 添加域名</h5>
          <ol>
            <li>在 DNSPod 添加您要管理的域名</li>
            <li>用户可以在 "我的域名" 中申请添加域名</li>
            <li>管理员审核并分配域名给用户</li>
          </ol>
        </div>
        <div class="help-item">
          <h5>3. DNS 解析</h5>
          <ol>
            <li>用户选择自己的域名进入解析管理</li>
            <li>添加 A、CNAME、MX 等记录</li>
            <li>系统会自动同步到 DNSPod</li>
          </ol>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 800px;
  margin: 0 auto;
}

.mt-4 {
  margin-top: 24px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.setting-section h4 {
  font-size: 18px;
  margin-bottom: 12px;
}

.setting-desc {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 20px;
}

.setting-desc code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.saved-message {
  color: var(--color-accent);
  font-size: 14px;
}

.help-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.help-item h5 {
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--color-accent);
}

.help-item ol {
  padding-left: 20px;
  color: var(--color-text-secondary);
}

.help-item li {
  margin-bottom: 8px;
}

.help-item code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}
</style>
