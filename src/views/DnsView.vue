<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDomainStore } from '@/stores/domains'
import { useI18n } from 'vue-i18n'
import Card from '@/components/Card.vue'
import Button from '@/components/Button.vue'
import InputField from '@/components/InputField.vue'
import Modal from '@/components/Modal.vue'
import type { DnsRecord } from '@/types'

const route = useRoute()
const domainStore = useDomainStore()
const { t } = useI18n()

const domainName = computed(() => route.params.domain as string)

const showAddModal = ref(false)
const showEditModal = ref(false)
const editingRecord = ref<DnsRecord | null>(null)

const form = ref({
  name: '',
  type: 'A',
  value: '',
  priority: 10,
  ttl: 600
})

const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']

onMounted(() => {
  domainStore.fetchRecords(domainName.value)
})

function resetForm() {
  form.value = {
    name: '',
    type: 'A',
    value: '',
    priority: 10,
    ttl: 600
  }
}

function openEditModal(record: DnsRecord) {
  editingRecord.value = record
  form.value = {
    name: record.name,
    type: record.type,
    value: record.value,
    priority: record.priority,
    ttl: record.ttl
  }
  showEditModal.value = true
}

async function handleAddRecord() {
  if (!form.value.name || !form.value.value) return
  const success = await domainStore.createRecord(domainName.value, form.value)
  if (success) {
    showAddModal.value = false
    resetForm()
  }
}

async function handleUpdateRecord() {
  if (!editingRecord.value || !form.value.name || !form.value.value) return
  const success = await domainStore.updateRecord(domainName.value, editingRecord.value.id, form.value)
  if (success) {
    showEditModal.value = false
    editingRecord.value = null
    resetForm()
  }
}

async function handleDeleteRecord(id: number) {
  if (confirm(t('dns.deleteRecordConfirm'))) {
    await domainStore.deleteRecord(domainName.value, id)
  }
}
</script>

<template>
  <div class="dns-page">
    <div class="page-header">
      <div class="header-left">
        <router-link to="/domains" class="back-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </router-link>
        <div>
          <h1>{{ domainName }}</h1>
          <p class="subtitle">{{ t('dns.subtitle') }}</p>
        </div>
      </div>
      <Button @click="showAddModal = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('dns.addRecord') }}
      </Button>
    </div>

    <Card>
      <div v-if="domainStore.loading" class="loading">{{ t('common.loading') }}</div>
      <div v-else-if="domainStore.records.length === 0" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/>
        </svg>
        <p>{{ t('dns.noRecords') }}</p>
      </div>
      <table v-else class="records-table">
        <thead>
          <tr>
            <th>{{ t('dns.recordName') }}</th>
            <th>{{ t('dns.recordType') }}</th>
            <th>{{ t('dns.recordValue') }}</th>
            <th>{{ t('dns.recordPriority') }}</th>
            <th>{{ t('dns.recordTTL') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in domainStore.records" :key="record.id">
            <td class="name-cell">{{ record.name || '@' }}</td>
            <td><span class="type-badge">{{ record.type }}</span></td>
            <td class="value-cell">{{ record.value }}</td>
            <td>{{ record.priority }}</td>
            <td>{{ record.ttl }}</td>
            <td class="actions-cell">
              <button class="action-btn" @click="openEditModal(record)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="action-btn danger" @click="handleDeleteRecord(record.id)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <Modal v-model:show="showAddModal" :title="t('dns.addRecordTitle')">
      <form @submit.prevent="handleAddRecord" class="record-form">
        <div class="form-row">
          <InputField v-model="form.name" :label="t('dns.recordName')" :placeholder="t('dns.recordNamePlaceholder')"/>
          <div class="select-field">
            <label>{{ t('dns.recordType') }}</label>
            <select v-model="form.type">
              <option v-for="type in recordTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </div>
        </div>
        <InputField v-model="form.value" :label="t('dns.recordValue')" :placeholder="t('dns.recordValuePlaceholder')"/>
        <div class="form-row">
          <InputField v-model.number="form.priority" type="number" :label="t('dns.recordPriority')" :placeholder="t('dns.recordPriorityPlaceholder')"/>
          <InputField v-model.number="form.ttl" type="number" :label="t('dns.recordTTL')" :placeholder="t('dns.recordTTLPlaceholder')"/>
        </div>
        <div class="form-actions">
          <Button variant="secondary" type="button" @click="showAddModal = false; resetForm()">{{ t('common.cancel') }}</Button>
          <Button type="submit">{{ t('common.add') }}</Button>
        </div>
      </form>
    </Modal>

    <Modal v-model:show="showEditModal" :title="t('dns.editRecordTitle')">
      <form @submit.prevent="handleUpdateRecord" class="record-form">
        <div class="form-row">
          <InputField v-model="form.name" :label="t('dns.recordName')" :placeholder="t('dns.recordNamePlaceholder')"/>
          <div class="select-field">
            <label>{{ t('dns.recordType') }}</label>
            <select v-model="form.type">
              <option v-for="type in recordTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </div>
        </div>
        <InputField v-model="form.value" :label="t('dns.recordValue')" :placeholder="t('dns.recordValuePlaceholder')"/>
        <div class="form-row">
          <InputField v-model.number="form.priority" type="number" :label="t('dns.recordPriority')" :placeholder="t('dns.recordPriorityPlaceholder')"/>
          <InputField v-model.number="form.ttl" type="number" :label="t('dns.recordTTL')" :placeholder="t('dns.recordTTLPlaceholder')"/>
        </div>
        <div class="form-actions">
          <Button variant="secondary" type="button" @click="showEditModal = false; resetForm()">{{ t('common.cancel') }}</Button>
          <Button type="submit">{{ t('common.save') }}</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.dns-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--color-card);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.back-link:hover {
  background: var(--color-secondary);
  color: var(--color-text);
}

.page-header h1 {
  font-size: 24px;
}

.subtitle {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.loading {
  text-align: center;
  padding: 60px;
  color: var(--color-text-secondary);
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: var(--color-text-secondary);
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.records-table {
  width: 100%;
  border-collapse: collapse;
}

.records-table th,
.records-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.records-table th {
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.records-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.name-cell {
  font-weight: 500;
}

.type-badge {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(45, 90, 135, 0.3);
  color: #5b9bd5;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.value-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions-cell {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

.action-btn.danger:hover {
  background: rgba(255, 107, 107, 0.2);
  color: var(--color-danger);
}

.record-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.select-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.select-field label {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.select-field select {
  padding: 12px 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 14px;
}

.select-field select:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.1);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>
