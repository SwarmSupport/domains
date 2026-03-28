import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import en from './locales/en'

// Detect browser language and default to English for unknown languages
function getBrowserLocale(): string {
  const browserLocale = navigator.language || 'en'
  // Check if browser locale starts with 'zh'
  if (browserLocale.toLowerCase().startsWith('zh')) {
    return 'zh'
  }
  // Default to English for all other languages
  return 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || getBrowserLocale(),
  fallbackLocale: 'en',
  messages: {
    zh,
    en
  }
})

export default i18n

export function setLocale(locale: 'zh' | 'en') {
  localStorage.setItem('locale', locale)
  i18n.global.locale.value = locale
}

export function getLocale(): string {
  return i18n.global.locale.value
}
