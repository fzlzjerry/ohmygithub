<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GitBranch, GitBranchPlus, Search, Tag } from 'lucide-vue-next'
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@oh-my-github/ui'
import {
  useRepositoryBranchesDetailedQuery,
  useRepositoryRefsInvalidation,
  useRepositoryTagsQuery,
} from '@/composables/github/use-repositories'
import { useToast } from '@/composables/use-toast'
import BranchList from './branch-list.vue'
import TagList from './tag-list.vue'
import CreateBranchDialog from './create-branch-dialog.vue'
import RenameBranchDialog from './rename-branch-dialog.vue'
import CreateTagDialog from './create-tag-dialog.vue'
import DeleteRefDialog from './delete-ref-dialog.vue'
import type { DeleteRefTarget } from './delete-ref-dialog.vue'

const props = defineProps<{
  owner: string
  repo: string
  defaultBranch: string | null
}>()

const PER_PAGE = 20
const SEARCH_DEBOUNCE_MS = 300

type RefTabId = 'branches' | 'tags'

const { t } = useI18n()
const toast = useToast()
const { invalidateBranches, invalidateTags } = useRepositoryRefsInvalidation()

const activeTab = ref<RefTabId>('branches')
const searchInput = ref('')
const debouncedSearch = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const page = ref(1)

const isCreateBranchOpen = ref(false)
const isCreateTagOpen = ref(false)
const renamingBranch = ref<GitHubBranchListItem | null>(null)
const deletingRef = ref<DeleteRefTarget | null>(null)

const refTabs = computed(() => [
  { id: 'branches' as const, icon: GitBranch, label: t('repository.branches.tabs.branches') },
  { id: 'tags' as const, icon: Tag, label: t('repository.branches.tabs.tags') },
])

const hasRepositoryIdentity = computed(() => Boolean(props.owner && props.repo))
const branchesQuery = useRepositoryBranchesDetailedQuery(
  () => props.owner,
  () => props.repo,
  debouncedSearch,
  page,
  () => PER_PAGE,
  () => props.defaultBranch,
  computed(() => hasRepositoryIdentity.value && activeTab.value === 'branches'),
)
const tagsQuery = useRepositoryTagsQuery(
  () => props.owner,
  () => props.repo,
  debouncedSearch,
  page,
  () => PER_PAGE,
  computed(() => hasRepositoryIdentity.value && activeTab.value === 'tags'),
)

const branchPage = computed(() => branchesQuery.data.value ?? null)
const tagPage = computed(() => tagsQuery.data.value ?? null)
const activeQuery = computed(() => (activeTab.value === 'branches' ? branchesQuery : tagsQuery))
const isLoading = computed(() => activeQuery.value.isLoading.value)
const hasError = computed(() => Boolean(activeQuery.value.error.value))
const totalCount = computed(() =>
  (activeTab.value === 'branches' ? branchPage.value?.totalCount : tagPage.value?.totalCount) ?? 0,
)
const hasNextPage = computed(() =>
  (activeTab.value === 'branches' ? branchPage.value?.hasNextPage : tagPage.value?.hasNextPage) ?? false,
)
const resolvedDefaultBranch = computed(() => branchPage.value?.defaultBranch ?? props.defaultBranch)

watch(searchInput, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }

  searchTimer = setTimeout(() => {
    debouncedSearch.value = value.trim()
    page.value = 1
    searchTimer = null
  }, SEARCH_DEBOUNCE_MS)
})

watch(activeTab, () => {
  searchInput.value = ''
  debouncedSearch.value = ''
  page.value = 1
})

watch(
  () => [props.owner, props.repo] as const,
  () => {
    searchInput.value = ''
    debouncedSearch.value = ''
    page.value = 1
  },
)

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
})

function refetchActive(): void {
  void activeQuery.value.refetch()
}

function handleBranchCreated(name: string): void {
  toast.success(t('repository.branches.toasts.branchCreated', { name }))
  page.value = 1
  invalidateBranches(props.owner, props.repo)
}

function handleBranchRenamed(name: string): void {
  toast.success(t('repository.branches.toasts.branchRenamed', { name }))
  invalidateBranches(props.owner, props.repo)
}

function handleTagCreated(name: string): void {
  toast.success(t('repository.branches.toasts.tagCreated', { name }))
  page.value = 1
  invalidateTags(props.owner, props.repo)
}

function handleRefDeleted(target: DeleteRefTarget): void {
  toast.success(t(
    target.kind === 'branch'
      ? 'repository.branches.toasts.branchDeleted'
      : 'repository.branches.toasts.tagDeleted',
    { name: target.name },
  ))

  if (target.kind === 'branch') {
    invalidateBranches(props.owner, props.repo)
    return
  }

  invalidateTags(props.owner, props.repo)
}
</script>

<template>
  <section class="grid gap-3">
    <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="grid min-w-0 gap-1">
        <h2 class="select-none truncate text-title font-semibold text-foreground">
          {{ t('repository.branches.title') }}
        </h2>
        <p class="select-none text-body text-muted-foreground">
          {{ t('repository.branches.description') }}
        </p>
      </div>
      <Button
        v-if="activeTab === 'branches'"
        :disabled="!hasRepositoryIdentity"
        size="sm"
        type="button"
        @click="isCreateBranchOpen = true"
      >
        <GitBranchPlus
          class="size-3.5"
          :stroke-width="1.75"
        />
        {{ t('repository.branches.createBranch') }}
      </Button>
      <Button
        v-else
        :disabled="!hasRepositoryIdentity"
        size="sm"
        type="button"
        @click="isCreateTagOpen = true"
      >
        <Tag
          class="size-3.5"
          :stroke-width="1.75"
        />
        {{ t('repository.branches.createTag') }}
      </Button>
    </div>

    <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <nav
        :aria-label="t('repository.branches.tabs.label')"
        class="flex min-w-0 flex-wrap items-center gap-1"
      >
        <button
          v-for="tab in refTabs"
          :key="tab.id"
          :aria-current="tab.id === activeTab ? 'page' : undefined"
          class="inline-flex h-8 select-none items-center gap-1.5 border-b px-2 text-body font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring/30"
          :class="tab.id === activeTab
            ? 'border-foreground text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'"
          type="button"
          @click="activeTab = tab.id"
        >
          <component
            :is="tab.icon"
            class="size-3.5"
          />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <InputGroup
        class="w-full sm:max-w-xs"
        size="sm"
      >
        <InputGroupAddon>
          <Search class="size-3.5 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          :disabled="!hasRepositoryIdentity"
          :model-value="searchInput"
          :placeholder="t(
            activeTab === 'branches'
              ? 'repository.branches.search.branchesPlaceholder'
              : 'repository.branches.search.tagsPlaceholder',
          )"
          type="search"
          @update:model-value="(value: string | number) => searchInput = String(value)"
        />
      </InputGroup>
    </div>

    <BranchList
      v-if="activeTab === 'branches'"
      :branches="branchPage?.items ?? []"
      :has-error="hasError"
      :has-identity="hasRepositoryIdentity"
      :has-next-page="hasNextPage"
      :is-loading="isLoading"
      :owner="owner"
      :page="page"
      :per-page="PER_PAGE"
      :repo="repo"
      :search="debouncedSearch"
      :total-count="totalCount"
      @delete="deletingRef = { kind: 'branch', name: $event.name }"
      @rename="renamingBranch = $event"
      @retry="refetchActive"
      @update:page="page = $event"
    />

    <TagList
      v-else
      :has-error="hasError"
      :has-identity="hasRepositoryIdentity"
      :has-next-page="hasNextPage"
      :is-loading="isLoading"
      :page="page"
      :per-page="PER_PAGE"
      :search="debouncedSearch"
      :tags="tagPage?.items ?? []"
      :total-count="totalCount"
      @delete="deletingRef = { kind: 'tag', name: $event.name }"
      @retry="refetchActive"
      @update:page="page = $event"
    />

    <CreateBranchDialog
      v-model:open="isCreateBranchOpen"
      :default-branch="resolvedDefaultBranch"
      :owner="owner"
      :repo="repo"
      @created="handleBranchCreated"
    />

    <RenameBranchDialog
      :branch="renamingBranch"
      :open="renamingBranch !== null"
      :owner="owner"
      :repo="repo"
      @renamed="handleBranchRenamed"
      @update:open="(open) => { if (!open) renamingBranch = null }"
    />

    <CreateTagDialog
      v-model:open="isCreateTagOpen"
      :default-branch="resolvedDefaultBranch"
      :owner="owner"
      :repo="repo"
      @created="handleTagCreated"
    />

    <DeleteRefDialog
      :open="deletingRef !== null"
      :owner="owner"
      :repo="repo"
      :target="deletingRef"
      @deleted="handleRefDeleted"
      @update:open="(open) => { if (!open) deletingRef = null }"
    />
  </section>
</template>
