<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@oh-my-github/ui'
import { PanelLeft, Rows3, Sparkles, Zap } from 'lucide-vue-next'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Placeholder feature set — copy is intentionally light for now.
const features: { key: string, icon: Component }[] = [
  { key: 'sidebar', icon: PanelLeft },
  { key: 'seamless', icon: Rows3 },
  { key: 'fast', icon: Zap },
  { key: 'crossPlatform', icon: Sparkles }
]
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-16 sm:px-6">
    <h2 class="text-center text-2xl font-medium tracking-tight">
      {{ t('features.title') }}
    </h2>

    <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card v-for="feature in features" :key="feature.key">
        <CardHeader>
          <div class="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
            <component :is="feature.icon" class="size-5" />
          </div>
          <CardTitle class="mt-3 font-medium">
            {{ t(`features.items.${feature.key}.title`) }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            {{ t(`features.items.${feature.key}.description`) }}
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
