<script setup lang="ts">
import type { PullRequestDetail } from './types'
import type { Component } from 'vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@oh-my-github/ui'
import {
  AlertCircle,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  CircleDot,
  GitCommitHorizontal,
  GitMerge,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-vue-next'
import { GitHubActorLink, WorkItemStateBadge } from '../../../components'
import { setIssueLock, setIssueSubscription } from '../../../composables/github/use-issues'
import { updatePullRequest } from '../../../composables/github/use-pull-requests'

const props = defineProps<{
  pullRequest: PullRequestDetail
  repository: string
}>()

const emit = defineEmits<{ refetch: [] }>()

interface PullRequestTabItem {
  id: string
  icon: Component
  label: string
  disabled: boolean
}

interface PullRequestHeaderStatus {
  label: string
  variant: 'default' | 'destructive' | 'success' | 'warning' | 'info' | 'outline'
  icon: Component
}

const { t } = useI18n()
const router = useRouter()

const pullRequestNumber = computed(() => `#${props.pullRequest.number}`)
const createdAt = computed(() => formatDate(props.pullRequest.createdAt))
const updatedAt = computed(() => formatDate(props.pullRequest.updatedAt))
const stateLabel = computed(() => t(`pullRequest.states.${props.pullRequest.state}`))
const updatedMeta = computed(() =>
  t('pullRequest.meta.updated', {
    date: updatedAt.value,
  })
)
const repositoryUrl = computed(() =>
  props.pullRequest.owner && props.pullRequest.repo
    ? `/${encodeURIComponent(props.pullRequest.owner)}/${encodeURIComponent(props.pullRequest.repo)}`
    : null
)
const normalizedMergeable = computed(() =>
  String(props.pullRequest.status.mergeable ?? '').toLowerCase()
)
const normalizedMergeState = computed(() =>
  String(props.pullRequest.status.mergeStateStatus ?? '').toUpperCase()
)
const hasConflicts = computed(() =>
  normalizedMergeable.value === 'conflicting' || normalizedMergeState.value === 'DIRTY'
)
const hasBlockingRequirements = computed(() =>
  props.pullRequest.reviewDecision === 'review_required'
  || props.pullRequest.reviewDecision === 'changes_requested'
  || props.pullRequest.status.ciState === 'failure'
  || props.pullRequest.status.ciState === 'pending'
  || ['BLOCKED', 'BEHIND', 'UNSTABLE', 'HAS_HOOKS'].includes(normalizedMergeState.value)
)
const headerStatus = computed<PullRequestHeaderStatus>(() => {
  if (props.pullRequest.state === 'merged') {
    return {
      label: t('pullRequest.headerStatus.merged'),
      variant: 'success',
      icon: GitMerge,
    }
  }

  if (props.pullRequest.state === 'closed') {
    return {
      label: t('pullRequest.headerStatus.closed'),
      variant: 'default',
      icon: CircleDot,
    }
  }

  if (props.pullRequest.state === 'draft') {
    return {
      label: t('pullRequest.headerStatus.draft'),
      variant: 'default',
      icon: CircleDot,
    }
  }

  if (hasConflicts.value) {
    return {
      label: t('pullRequest.headerStatus.conflicts'),
      variant: 'destructive',
      icon: AlertCircle,
    }
  }

  if (props.pullRequest.reviewDecision === 'review_required') {
    return {
      label: t('pullRequest.headerStatus.awaitingApproval'),
      variant: 'warning',
      icon: CircleDot,
    }
  }

  if (props.pullRequest.reviewDecision === 'changes_requested') {
    return {
      label: t('pullRequest.headerStatus.changesRequested'),
      variant: 'warning',
      icon: AlertCircle,
    }
  }

  if (normalizedMergeState.value === 'BEHIND') {
    return {
      label: t('pullRequest.headerStatus.behind'),
      variant: 'warning',
      icon: CircleDot,
    }
  }

  if (normalizedMergeState.value === 'BLOCKED' || normalizedMergeState.value === 'HAS_HOOKS') {
    return {
      label: t('pullRequest.headerStatus.blocked'),
      variant: 'warning',
      icon: CircleDot,
    }
  }

  if (props.pullRequest.status.ciState === 'failure' || normalizedMergeState.value === 'UNSTABLE') {
    return {
      label: t('pullRequest.headerStatus.checksFailing'),
      variant: 'warning',
      icon: AlertCircle,
    }
  }

  if (props.pullRequest.status.ciState === 'pending') {
    return {
      label: t('pullRequest.headerStatus.checksPending'),
      variant: 'warning',
      icon: CircleDot,
    }
  }

  if (props.pullRequest.state === 'open' && !hasBlockingRequirements.value) {
    return {
      label: t('pullRequest.headerStatus.readyToMerge'),
      variant: 'success',
      icon: CheckCircle2,
    }
  }

  return {
    label: t('pullRequest.headerStatus.unknown'),
    variant: 'default',
    icon: CircleDot,
  }
})
const isEditingTitle = ref(false)
const titleDraft = ref('')
const titleError = ref<string | null>(null)
const isSavingTitle = ref(false)
const isBusy = ref(false)
const nodeId = computed(() => props.pullRequest.nodeId ?? '')
const isSubscribed = computed(() => props.pullRequest.viewerSubscription === 'SUBSCRIBED')
const isLocked = computed(() => Boolean(props.pullRequest.locked))
const tabs = computed<PullRequestTabItem[]>(() => [
  {
    id: 'conversations',
    icon: MessageSquare,
    label: t('pullRequest.tabs.conversations'),
    disabled: false,
  },
  {
    id: 'commits',
    icon: GitCommitHorizontal,
    label: t('pullRequest.tabs.commits'),
    disabled: true,
  },
  {
    id: 'checks',
    icon: ShieldCheck,
    label: t('pullRequest.tabs.checks'),
    disabled: true,
  },
  {
    id: 'review',
    icon: ShieldCheck,
    label: t('pullRequest.tabs.review'),
    disabled: true,
  },
])

async function runAction(action: () => Promise<void>): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true
  try { await action(); emit('refetch') } finally { isBusy.value = false }
}

function toggleSubscription(): void {
  if (!nodeId.value) return
  void runAction(() => setIssueSubscription(nodeId.value, !isSubscribed.value))
}

function toggleLock(): void {
  void runAction(() => setIssueLock(props.pullRequest.owner, props.pullRequest.repo, props.pullRequest.number, !isLocked.value))
}

function openRepository(): void {
  if (!repositoryUrl.value) return

  void router.push(repositoryUrl.value)
}

function startTitleEdit(): void {
  if (!props.pullRequest.viewerCanUpdate) return

  titleDraft.value = props.pullRequest.title
  titleError.value = null
  isEditingTitle.value = true
}

function cancelTitleEdit(): void {
  titleDraft.value = ''
  titleError.value = null
  isEditingTitle.value = false
}

async function saveTitle(): Promise<void> {
  const nextTitle = titleDraft.value.trim()
  if (!props.pullRequest.viewerCanUpdate || !nextTitle || isSavingTitle.value) return

  if (nextTitle === props.pullRequest.title) {
    cancelTitleEdit()
    return
  }

  isSavingTitle.value = true
  titleError.value = null

  try {
    await updatePullRequest(props.pullRequest.owner, props.pullRequest.repo, props.pullRequest.number, {
      title: nextTitle,
    })
    cancelTitleEdit()
    emit('refetch')
  } catch {
    titleError.value = t('pullRequest.edit.titleError')
  } finally {
    isSavingTitle.value = false
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return t('pullRequest.values.unknown')

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return t('pullRequest.values.unknown')

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
</script>

<template>
  <header class="grid gap-3 border-b border-border pb-4">
    <div class="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div class="grid min-w-0 gap-2 md:flex-1">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <WorkItemStateBadge
            kind="pull-request"
            :label="stateLabel"
            :state="pullRequest.state"
          />
          <button
            v-if="repositoryUrl"
            class="truncate rounded-sm text-body text-muted-foreground outline-hidden underline-offset-4 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring/30"
            type="button"
            @click="openRepository"
          >
            {{ repository }} {{ pullRequestNumber }}
          </button>
          <span
            v-else
            class="truncate text-body text-muted-foreground"
          >
            {{ repository }} {{ pullRequestNumber }}
          </span>
        </div>

        <form
          v-if="isEditingTitle"
          class="grid min-w-0 gap-2"
          @submit.prevent="saveTitle"
        >
          <div class="flex min-w-0 items-center gap-2">
            <Input
              v-model="titleDraft"
              :aria-label="t('pullRequest.edit.titleInput')"
              class="min-w-0 flex-1"
              :disabled="isSavingTitle"
              size="lg"
            />
            <Button
              :aria-label="t('pullRequest.edit.cancelTitle')"
              class="size-9"
              :disabled="isSavingTitle"
              size="icon"
              type="button"
              variant="outline"
              @click="cancelTitleEdit"
            >
              <X class="size-4" />
            </Button>
            <Button
              :aria-label="t('pullRequest.edit.saveTitle')"
              class="size-9"
              :disabled="!titleDraft.trim()"
              :loading="isSavingTitle"
              size="icon"
              type="submit"
            >
              <Check class="size-4" />
            </Button>
          </div>
          <p
            v-if="titleError"
            class="text-body text-destructive"
            role="alert"
          >
            {{ titleError }}
          </p>
        </form>
        <div
          v-else
          class="flex min-w-0 items-center gap-2"
        >
          <h1 class="min-w-0 text-heading font-semibold leading-tight text-foreground">
            {{ pullRequest.title }}
          </h1>
          <Button
            v-if="pullRequest.viewerCanUpdate"
            :aria-label="t('pullRequest.edit.editTitle')"
            class="size-7 shrink-0 text-muted-foreground"
            size="icon-sm"
            type="button"
            variant="ghost"
            @click="startTitleEdit"
          >
            <Pencil class="size-3.5" />
          </Button>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <Badge
          class="h-8 rounded-md px-2.5 text-body"
          :variant="headerStatus.variant"
        >
          <component
            :is="headerStatus.icon"
            class="size-3.5"
          />
          <span>{{ headerStatus.label }}</span>
        </Badge>

        <DropdownMenu v-if="pullRequest.url">
          <DropdownMenuTrigger as-child>
            <Button
              :aria-label="t('pullRequest.actions.more')"
              class="size-8 text-muted-foreground"
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <MoreHorizontal class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              :disabled="isBusy || !nodeId"
              @select="toggleSubscription"
            >
              <component :is="isSubscribed ? BellOff : Bell" class="size-3.5" />
              <span>{{ isSubscribed ? t('pullRequest.actions.unsubscribe') : t('pullRequest.actions.subscribe') }}</span>
            </DropdownMenuItem>
            <template v-if="pullRequest.viewerCanUpdate">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                :disabled="isBusy"
                @select="toggleLock"
              >
                <component :is="isLocked ? Unlock : Lock" class="size-3.5" />
                <span>{{ isLocked ? t('pullRequest.actions.unlock') : t('pullRequest.actions.lock') }}</span>
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body text-muted-foreground">
      <span class="shrink-0">{{ t('pullRequest.meta.createdByPrefix') }}</span>
      <GitHubActorLink
        class="text-body"
        :avatar-url="pullRequest.author.avatarUrl"
        :login="pullRequest.author.login"
        :show-avatar="false"
      />
      <span class="truncate">{{ t('pullRequest.meta.createdByDate', { date: createdAt }) }}</span>
      <span aria-hidden="true">·</span>
      <span class="truncate">{{ updatedMeta }}</span>
    </div>

    <nav
      :aria-label="t('pullRequest.tabs.label')"
      class="flex min-w-0 flex-wrap items-center gap-1"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="inline-flex h-8 select-none items-center gap-1.5 border-b px-2 text-body font-medium outline-hidden transition-colors"
        :class="tab.disabled ? 'cursor-not-allowed border-transparent text-muted-foreground/70' : 'border-foreground text-foreground'"
        :aria-current="tab.disabled ? undefined : 'page'"
        :aria-disabled="tab.disabled ? 'true' : undefined"
        :disabled="tab.disabled"
        type="button"
      >
        <component
          :is="tab.icon"
          class="size-3.5"
        />
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </header>
</template>
