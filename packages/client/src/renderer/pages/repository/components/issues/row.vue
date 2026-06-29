<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Badge,
} from '@oh-my-github/ui'
import { GitHubActorLink, WorkItemStateIcon } from '../../../../components'

const props = defineProps<{
  issue: GitHubIssue
}>()

const emit = defineEmits<{
  select: [issue: GitHubIssue]
}>()

const { t } = useI18n()

const stateLabel = computed(() => t(`repository.issues.states.${props.issue.state}`))
const updatedAt = computed(() => formatDate(props.issue.updatedAt))

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function selectIssue(): void {
  emit('select', props.issue)
}
</script>

<template>
  <div
    class="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 p-4 text-left outline-hidden transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/30"
    role="button"
    tabindex="0"
    @click="selectIssue"
    @keydown.enter.prevent="selectIssue"
    @keydown.space.prevent="selectIssue"
  >
    <div class="relative mt-0.5 flex size-5 items-center justify-center">
      <WorkItemStateIcon
        kind="issue"
        size="md"
        :state="issue.state"
      />
      <span
        v-if="issue.hasUpdates"
        class="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-info"
      />
    </div>

    <div class="grid min-w-0 gap-2">
      <div class="flex min-w-0 items-start gap-2">
        <div class="min-w-0 flex-1">
          <div class="truncate text-control font-medium text-foreground">
            #{{ issue.number }} {{ issue.title }}
          </div>
          <div class="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body text-muted-foreground">
            <Badge
              size="sm"
              variant="secondary"
            >
              {{ stateLabel }}
            </Badge>
            <span>{{ t('repository.issues.meta.updated', { date: updatedAt }) }}</span>
            <GitHubActorLink
              avatar-size="xs"
              :avatar-url="issue.author.avatarUrl"
              :login="issue.author.login"
            />
          </div>
        </div>
      </div>

      <div
        v-if="issue.labels.length > 0"
        class="flex min-w-0 flex-wrap gap-1.5"
      >
        <Badge
          v-for="label in issue.labels"
          :key="label"
          size="sm"
          variant="outline"
        >
          {{ label }}
        </Badge>
      </div>
    </div>
  </div>
</template>
