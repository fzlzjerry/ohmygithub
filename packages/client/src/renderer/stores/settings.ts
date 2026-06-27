import { computed, watch } from 'vue'
import { useColorMode, useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { i18n, type SupportedLocale } from '../i18n'

export type ThemePreference = 'auto' | 'light' | 'dark'

export const useSettingsStore = defineStore('settings', () => {
  const theme = useStorage<ThemePreference>('oh-my-github:theme', 'auto')
  const locale = useStorage<SupportedLocale>('oh-my-github:locale', 'en')

  const colorMode = useColorMode({
    initialValue: theme.value,
    modes: {
      light: 'light',
      dark: 'dark',
      auto: ''
    }
  })

  const isDark = computed(() => colorMode.value === 'dark')

  function setTheme(value: ThemePreference): void {
    theme.value = value
    colorMode.value = value
  }

  function setLocale(value: SupportedLocale): void {
    locale.value = value
    i18n.global.locale.value = value
  }

  watch(
    locale,
    (value) => {
      i18n.global.locale.value = value
    },
    { immediate: true }
  )

  return {
    colorMode,
    isDark,
    locale,
    setLocale,
    setTheme,
    theme
  }
})
