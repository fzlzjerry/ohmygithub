import { createI18n } from 'vue-i18n'
import en from './i18n/locales/en.json'
import zh from './i18n/locales/zh.json'

export type SupportedLocale = 'en' | 'zh'

const STORAGE_KEY = 'omg-web-locale'

function normalizeLocale(value: string | null | undefined): SupportedLocale {
  return value === 'zh' ? 'zh' : 'en'
}

function initialLocale(): SupportedLocale {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (stored) return normalizeLocale(stored)
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages: { en, zh }
})

export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

// Reflect the initial locale onto <html lang>.
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.global.locale.value
}
