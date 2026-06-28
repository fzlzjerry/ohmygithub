<script setup lang="ts">
import type { WorkspaceTab } from '../workspace/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@oh-my-github/ui'
import { CircleDot, Inbox, ListChecks } from 'lucide-vue-next'

const props = defineProps<{
  tab: WorkspaceTab
}>()

const { t } = useI18n()

const categoryKey = computed(() => props.tab.issueCategory ?? 'inbox')
const categoryLabel = computed(() => t(`workspace.sidebar.issueCategories.${categoryKey.value}`))

const summaryItems = computed(() => [
  {
    id: 'category',
    icon: CircleDot,
    label: t('issueList.summary.category'),
    value: categoryLabel.value,
  },
  {
    id: 'source',
    icon: Inbox,
    label: t('issueList.summary.source'),
    value: t(`issueList.sources.${categoryKey.value}`),
  },
  {
    id: 'status',
    icon: ListChecks,
    label: t('issueList.summary.status'),
    value: t('issueList.values.placeholder'),
  },
])
</script>

<template>
  <section class="min-h-full bg-background">
    <div class="mx-auto grid w-full max-w-5xl gap-5 px-6 py-6">
      <div class="grid max-w-3xl gap-2">
        <Badge
          class="justify-self-start"
          variant="secondary"
        >
          <CircleDot />
          {{ t('issueList.eyebrow') }}
        </Badge>
        <h1 class="truncate text-heading font-semibold text-foreground">
          {{ categoryLabel }}
        </h1>
        <p class="max-w-2xl text-label text-muted-foreground">
          {{ t('issueList.description', { category: categoryLabel }) }}
        </p>
      </div>

      <div class="grid gap-2 sm:grid-cols-3">
        <div
          v-for="item in summaryItems"
          :key="item.id"
          class="grid gap-2 rounded-lg border border-border bg-card p-3"
        >
          <div class="flex min-w-0 items-center gap-2 text-body font-medium text-muted-foreground">
            <component
              :is="item.icon"
              class="size-4 shrink-0"
            />
            <span class="truncate">{{ item.label }}</span>
          </div>
          <div class="truncate text-control font-semibold text-foreground">
            {{ item.value }}
          </div>
        </div>
      </div>

      <div class="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <div class="grid gap-2 rounded-lg border border-border bg-card p-3">
          <div class="text-label font-medium text-foreground">
            {{ t('issueList.sections.overview.title') }}
          </div>
          <p class="text-body text-muted-foreground">
            {{ t('issueList.sections.overview.description') }}
          </p>
        </div>

        <div class="grid gap-2 rounded-lg border border-border bg-card p-3">
          <div class="text-label font-medium text-foreground">
            {{ t('issueList.sections.sidebar.title') }}
          </div>
          <p class="text-body text-muted-foreground">
            {{ t('issueList.sections.sidebar.description') }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
