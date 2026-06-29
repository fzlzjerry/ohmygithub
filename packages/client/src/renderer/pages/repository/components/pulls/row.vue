<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Check,
  Circle,
  X,
} from 'lucide-vue-next'
import {
  Badge,
} from '@oh-my-github/ui'
import { GitHubActorLink, WorkItemStateIcon } from '../../../../components'

const props = defineProps<{
  pullRequest: GitHubPullRequest
}>()

const emit = defineEmits<{
  select: [pullRequest: GitHubPullRequest]
}>()

const { t } = useI18n()

const stateLabel = computed(() => t(`repository.pullRequests.states.${props.pullRequest.state}`))
const updatedAt = computed(() => formatDate(props.pullRequest.updatedAt))

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function selectPullRequest(): void {
  emit('select', props.pullRequest)
}
</script>

<template>
  <div
    class="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 p-4 text-left outline-hidden transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/30"
    role="button"
    tabindex="0"
    @click="selectPullRequest"
    @keydown.enter.prevent="selectPullRequest"
    @keydown.space.prevent="selectPullRequest"
  >
    <div class="relative mt-0.5 flex size-5 items-center justify-center">
      <WorkItemStateIcon
        kind="pull-request"
        size="md"
        :state="pullRequest.state"
      />
      <span
        v-if="pullRequest.hasUpdates"
        class="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-info"
      />
    </div>

    <div class="grid min-w-0 gap-2">
      <div class="flex min-w-0 items-start gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-2 text-control font-medium text-foreground">
            <span class="min-w-0 truncate">
              #{{ pullRequest.number }} {{ pullRequest.title }}
            </span>
            <span
              v-if="pullRequest.ciState"
              class="flex size-4 shrink-0 items-center justify-center"
              :title="t(`repository.pullRequests.checks.${pullRequest.ciState}`)"
            >
              <Check
                v-if="pullRequest.ciState === 'success'"
                class="size-4 text-success"
                :stroke-width="2"
              />
              <X
                v-else-if="pullRequest.ciState === 'failure'"
                class="size-4 text-destructive"
                :stroke-width="2"
              />
              <Circle
                v-else
                class="size-3 fill-warning text-warning"
                :stroke-width="2"
              />
            </span>
          </div>
          <div class="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body text-muted-foreground">
            <Badge
              size="sm"
              variant="secondary"
            >
              {{ stateLabel }}
            </Badge>
            <span>{{ t('repository.pullRequests.meta.updated', { date: updatedAt }) }}</span>
            <GitHubActorLink
              avatar-size="xs"
              :avatar-url="pullRequest.author.avatarUrl"
              :login="pullRequest.author.login"
            />
          </div>
        </div>
      </div>

      <div
        v-if="pullRequest.labels.length > 0"
        class="flex min-w-0 flex-wrap gap-1.5"
      >
        <Badge
          v-for="label in pullRequest.labels"
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
