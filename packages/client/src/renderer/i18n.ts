import { createI18n } from 'vue-i18n'
import en from './i18n/locales/en.json'
import zh from './i18n/locales/zh.json'

export type SupportedLocale = 'en' | 'zh'

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    zh
  }
})
