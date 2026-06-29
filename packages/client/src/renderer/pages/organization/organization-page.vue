<script setup lang="ts">
import type { WorkspaceTab } from '../workspace/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Activity, Building2, GitBranch, Users } from 'lucide-vue-next'
import { Badge } from '@oh-my-github/ui'

const props = defineProps<{
  tab: WorkspaceTab
}>()

const { t } = useI18n()

const organizationLogin = computed(() => props.tab.owner ?? props.tab.title)

const summaryItems = computed(() => [
  {
    id: 'repositories',
    icon: GitBranch,
    label: t('organization.summary.repositories'),
    value: t('organization.values.placeholder'),
  },
  {
    id: 'members',
    icon: Users,
    label: t('organization.summary.members'),
    value: t('organization.values.placeholder'),
  },
  {
    id: 'activity',
    icon: Activity,
    label: t('organization.summary.activity'),
    value: t('organization.values.placeholder'),
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
          <Building2 />
          {{ t('organization.eyebrow') }}
        </Badge>
        <h1 class="truncate text-heading font-semibold text-foreground">
          {{ organizationLogin }}
        </h1>
        <p class="max-w-2xl select-none text-label text-muted-foreground">
          {{ t('organization.description', { owner: organizationLogin }) }}
        </p>
      </div>

      <div class="grid gap-2 sm:grid-cols-3">
        <div
          v-for="item in summaryItems"
          :key="item.id"
          class="grid gap-2 rounded-lg border border-border bg-card p-3"
        >
          <div class="flex min-w-0 select-none items-center gap-2 text-body font-medium text-muted-foreground">
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
          <div class="select-none text-label font-medium text-foreground">
            {{ t('organization.sections.repositories.title') }}
          </div>
          <p class="text-body text-muted-foreground">
            {{ t('organization.sections.repositories.description') }}
          </p>
        </div>

        <div class="grid gap-2 rounded-lg border border-border bg-card p-3">
          <div class="select-none text-label font-medium text-foreground">
            {{ t('organization.sections.activity.title') }}
          </div>
          <p class="text-body text-muted-foreground">
            {{ t('organization.sections.activity.description') }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
