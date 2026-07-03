<script setup lang="ts">
import { Button } from '@oh-my-github/ui'
import { useI18n } from 'vue-i18n'
import logo from '@/assets/shadow-icon.svg'
import TelegramIcon from '@/components/icons/TelegramIcon.vue'
import { TELEGRAM_URL } from '@/lib/site'
import DownloadButton from './DownloadButton.vue'

const { t } = useI18n()
</script>

<template>
  <section class="mx-auto flex max-w-3xl flex-col items-center px-4 pt-20 pb-16 text-center sm:pt-28">
    <img :src="logo" alt="Oh My GitHub" class="size-24 sm:size-28" />

    <h1 class="mt-8 text-3xl font-medium tracking-tight sm:text-4xl">
      {{ t('hero.tagline') }}
    </h1>

    <p class="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
      {{ t('hero.subtitle') }}
    </p>

    <div class="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <DownloadButton />
      <Button
        v-if="TELEGRAM_URL"
        as="a"
        :href="TELEGRAM_URL"
        target="_blank"
        rel="noreferrer"
        variant="outline"
        size="lg"
      >
        <TelegramIcon class="size-4" />
        {{ t('hero.telegram') }}
      </Button>
      <Button
        v-else
        variant="outline"
        size="lg"
        :title="t('hero.telegram')"
      >
        <TelegramIcon class="size-4" />
        {{ t('hero.telegram') }}
      </Button>
    </div>
  </section>
</template>
