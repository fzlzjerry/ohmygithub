<script setup lang="ts">
import type { WorkspaceTab } from '../workspace/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@oh-my-github/ui'
import { CheckCircle2, GitPullRequest, GitPullRequestDraft, Shield } from 'lucide-vue-next'

const props = defineProps<{
  tab: WorkspaceTab
}>()

const { t } = useI18n()

const repository = computed(() => `${props.tab.owner ?? ''}/${props.tab.repo ?? ''}`)
const number = computed(() => props.tab.number ? `#${props.tab.number}` : '#')

const summaryItems = computed(() => [
  {
    id: 'repository',
    icon: GitPullRequest,
    label: t('pullRequest.summary.repository'),
    value: repository.value,
  },
  {
    id: 'status',
    icon: CheckCircle2,
    label: t('pullRequest.summary.status'),
    value: t('pullRequest.values.placeholder'),
  },
  {
    id: 'checks',
    icon: Shield,
    label: t('pullRequest.summary.checks'),
    value: t('pullRequest.values.placeholder'),
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
          <GitPullRequestDraft />
          {{ t('pullRequest.eyebrow') }}
        </Badge>
        <h1 class="truncate text-heading font-semibold text-foreground">
          {{ repository }} {{ number }}
        </h1>
        <p class="max-w-2xl text-label text-muted-foreground">
          {{ t('pullRequest.description', { repository, number }) }}
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
            {{ t('pullRequest.sections.overview.title') }}
          </div>
          <p class="text-body text-muted-foreground">
            {{ t('pullRequest.sections.overview.description') }}
          </p>
        </div>

        <div class="grid gap-2 rounded-lg border border-border bg-card p-3">
          <div class="text-label font-medium text-foreground">
            {{ t('pullRequest.sections.activity.title') }}
          </div>
          <p class="text-body text-muted-foreground">
            {{ t('pullRequest.sections.activity.description') }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
