<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  GitBranch,
  GitPullRequest,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Trash2,
} from 'lucide-vue-next'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@oh-my-github/ui'

const props = defineProps<{
  branch: GitHubBranchListItem
  owner: string
  repo: string
}>()

const emit = defineEmits<{
  rename: [branch: GitHubBranchListItem]
  delete: [branch: GitHubBranchListItem]
}>()

const { t } = useI18n()
const router = useRouter()

const authorLogin = computed(() => props.branch.author.login ?? props.branch.author.name ?? '')
const authorFallback = computed(() => authorLogin.value.slice(0, 2).toUpperCase() || '?')
const updatedText = computed(() => {
  if (!props.branch.committedDate) return ''

  return t('repository.branches.meta.updated', { date: formatDate(props.branch.committedDate) })
})
const showCompare = computed(() =>
  !props.branch.isDefault && props.branch.aheadBy !== null && props.branch.behindBy !== null,
)
const canDelete = computed(() => !props.branch.isDefault && !props.branch.isProtected)

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function openPullRequest(): void {
  const pullRequest = props.branch.associatedPullRequest
  if (!pullRequest) return

  void router.push(
    `/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/pull/${pullRequest.number}`
  )
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 transition-colors hover:bg-muted/50">
    <div class="grid min-w-0 gap-1">
      <div class="flex min-w-0 items-center gap-2">
        <code class="flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-body text-foreground">
          <GitBranch
            class="size-3 shrink-0 text-muted-foreground"
            :stroke-width="1.75"
          />
          <span class="min-w-0 truncate">{{ branch.name }}</span>
        </code>
        <Badge
          v-if="branch.isDefault"
          variant="outline"
        >
          {{ t('repository.branches.badges.default') }}
        </Badge>
        <Badge
          v-if="branch.isProtected"
          variant="secondary"
        >
          <ShieldCheck
            class="size-3"
            :stroke-width="1.75"
          />
          {{ t('repository.branches.badges.protected') }}
        </Badge>
      </div>
      <span class="flex min-w-0 items-center gap-2 text-body text-muted-foreground">
        <Avatar
          v-if="authorLogin"
          class="size-4 shrink-0"
        >
          <AvatarImage
            v-if="branch.author.avatarUrl"
            :alt="authorLogin"
            :src="branch.author.avatarUrl"
          />
          <AvatarFallback>{{ authorFallback }}</AvatarFallback>
        </Avatar>
        <span
          v-if="authorLogin"
          class="shrink-0"
        >{{ authorLogin }}</span>
        <span
          v-if="updatedText"
          class="min-w-0 truncate"
        >{{ updatedText }}</span>
        <code
          v-if="branch.shortSha"
          class="shrink-0 font-mono"
        >{{ branch.shortSha }}</code>
      </span>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <span
        v-if="showCompare"
        class="hidden select-none items-center gap-1.5 text-body text-muted-foreground sm:flex"
        :title="t('repository.branches.compare.hint')"
      >
        <span>{{ t('repository.branches.compare.ahead', { count: branch.aheadBy ?? 0 }) }}</span>
        <span class="text-border">·</span>
        <span>{{ t('repository.branches.compare.behind', { count: branch.behindBy ?? 0 }) }}</span>
      </span>
      <Button
        v-if="branch.associatedPullRequest"
        size="sm"
        type="button"
        variant="outline"
        @click="openPullRequest"
      >
        <GitPullRequest
          class="size-3.5"
          :stroke-width="1.75"
        />
        #{{ branch.associatedPullRequest.number }}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            :aria-label="t('repository.branches.actions.menu')"
            class="text-muted-foreground"
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreHorizontal class="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="emit('rename', branch)">
            <Pencil class="size-3.5" />
            {{ t('repository.branches.actions.rename') }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            :disabled="!canDelete"
            variant="destructive"
            @click="emit('delete', branch)"
          >
            <Trash2 class="size-3.5" />
            {{ t('repository.branches.actions.delete') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>
