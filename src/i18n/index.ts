import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import en from './locales/en'

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'zh',
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
