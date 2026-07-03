<script setup lang="ts">
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@oh-my-github/ui'
import { Check, Languages, Moon, Sun } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import logo from '@/assets/shadow-icon.svg'
import TelegramIcon from '@/components/icons/TelegramIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { setLocale, type SupportedLocale } from '@/i18n'
import { TELEGRAM_URL } from '@/lib/site'

const { t, locale } = useI18n()
const { isDark, toggle } = useTheme()

const languages: { value: SupportedLocale, label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '简体中文' }
]
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md"
  >
    <div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
      <a href="/" class="flex items-center gap-2.5">
        <img :src="logo" alt="" class="size-7" />
        <span class="text-base font-medium tracking-tight">{{ t('brand') }}</span>
      </a>

      <div class="flex items-center gap-1">
        <Button
          v-if="TELEGRAM_URL"
          as="a"
          :href="TELEGRAM_URL"
          target="_blank"
          rel="noreferrer"
          variant="ghost"
          size="icon"
          :aria-label="t('nav.telegram')"
        >
          <TelegramIcon class="size-4" />
        </Button>
        <Button
          v-else
          variant="ghost"
          size="icon"
          :aria-label="t('nav.telegram')"
          :title="t('nav.telegram')"
        >
          <TelegramIcon class="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" :aria-label="t('nav.language')">
              <Languages />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              v-for="lang in languages"
              :key="lang.value"
              @select="setLocale(lang.value)"
            >
              <span class="flex-1">{{ lang.label }}</span>
              <Check v-if="locale === lang.value" class="size-4" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          :aria-label="t('nav.toggleTheme')"
          @click="toggle"
        >
          <Sun v-if="isDark" />
          <Moon v-else />
        </Button>
      </div>
    </div>
  </header>
</template>
