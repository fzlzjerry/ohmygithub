import { useColorMode } from '@vueuse/core'
import { computed } from 'vue'

export type ThemePreference = 'auto' | 'light' | 'dark'

// Mirrors the desktop app: `.dark` class on <html>, persisted, `auto` follows
// the OS. See packages/client/src/renderer/stores/settings.ts.
const colorMode = useColorMode<ThemePreference>({
  initialValue: 'auto',
  modes: { auto: '', dark: 'dark', light: 'light' },
  storageKey: 'omg-web-theme'
})

export function useTheme() {
  const isDark = computed(() => colorMode.state.value === 'dark')

  function toggle(): void {
    // Resolve `auto` first so the toggle always flips the *visible* theme.
    colorMode.value = isDark.value ? 'light' : 'dark'
  }

  return { preference: colorMode, isDark, toggle }
}
