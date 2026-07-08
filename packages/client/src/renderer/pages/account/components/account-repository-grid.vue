<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Skeleton,
} from '@oh-my-github/ui'
import AppPagination from '@/components/navigation/app-pagination.vue'
import RepositoryCard from '@/components/github/repository-card.vue'

const props = defineProps<{
  disabled?: boolean
  hasError: boolean
  isLoading: boolean
  list?: string
  lists?: GitHubAccountStarList[]
  mode: 'repositories' | 'stars'
  page: number
  perPage: number
  repositories: GitHubAccountRepository[]
  search: string
  totalCount: number
}>()

const emit = defineEmits<{
  retry: []
  select: [repository: GitHubAccountRepository]
  'update:list': [list: string]
  'update:page': [page: number]
  'update:search': [search: string]
}>()

const { t } = useI18n()

const pageModel = computed({
  get: () => props.page,
  set: (page: number) => {
    emit('update:page', page)
  },
})
const showPagination = computed(() => props.totalCount > props.perPage || props.page > 1)
const hasSearch = computed(() => props.search.trim().length > 0)
const selectedList = computed(() => props.list ?? '')
const showLists = computed(() => props.mode === 'stars' && (props.lists?.length ?? 0) > 0)
const hasFilters = computed(() => hasSearch.value || selectedList.value.length > 0)
const emptyTitleKey = computed(() =>
  hasFilters.value ? `account.${props.mode}.search.empty.title` : `account.${props.mode}.empty.title`
)
const emptyDescriptionKey = computed(() =>
  hasFilters.value ? `account.${props.mode}.search.empty.description` : `account.${props.mode}.empty.description`
)

function updateSearch(value: string | number): void {
  emit('update:search', String(value))
}

function selectList(slug: string): void {
  emit('update:list', slug === selectedList.value ? '' : slug)
}

function listButtonClass(active: boolean): string[] {
  return [
    'h-7 shrink-0 select-none whitespace-nowrap rounded-lg px-3 text-body font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-40',
    active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
  ]
}
</script>

<template>
  <section class="grid gap-3">
    <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <div
        v-if="showLists"
        :aria-label="t('account.stars.categories.label')"
        class="flex w-full min-w-0 items-center gap-1 overflow-x-auto pb-0.5 sm:w-auto sm:flex-1"
        role="group"
      >
        <button
          :aria-pressed="selectedList === ''"
          :class="listButtonClass(selectedList === '')"
          :disabled="disabled"
          type="button"
          @click="selectList('')"
        >
          {{ t('account.stars.categories.all') }}
        </button>
        <button
          v-for="entry in lists"
          :key="entry.slug"
          :aria-pressed="selectedList === entry.slug"
          :class="listButtonClass(selectedList === entry.slug)"
          :disabled="disabled"
          :title="entry.description || undefined"
          type="button"
          @click="selectList(entry.slug)"
        >
          {{ entry.name }}
          <span class="opacity-60">{{ entry.itemsCount }}</span>
        </button>
      </div>
      <InputGroup
        class="w-full shrink-0 sm:max-w-xs"
        size="sm"
      >
        <InputGroupAddon>
          <Search class="size-3.5 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          :model-value="search"
          :disabled="disabled"
          :placeholder="t(`account.${mode}.search.placeholder`)"
          type="search"
          @update:model-value="updateSearch"
        />
      </InputGroup>
    </div>

    <div
      v-if="isLoading && repositories.length === 0"
      class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      <Skeleton
        v-for="index in 6"
        :key="index"
        class="h-52 rounded-lg"
      />
    </div>

    <Empty
      v-else-if="hasError"
      class="min-h-[18rem] border border-border bg-card"
    >
      <EmptyHeader>
        <EmptyTitle>
          {{ t(`account.${mode}.error.title`) }}
        </EmptyTitle>
        <EmptyDescription>
          {{ t(`account.${mode}.error.description`) }}
        </EmptyDescription>
        <Button
          class="justify-self-center"
          size="sm"
          type="button"
          variant="outline"
          @click="emit('retry')"
        >
          {{ t('account.error.retry') }}
        </Button>
      </EmptyHeader>
    </Empty>

    <Empty
      v-else-if="repositories.length === 0"
      class="min-h-[18rem] border border-border bg-card"
    >
      <EmptyHeader>
        <EmptyTitle>
          {{ t(emptyTitleKey) }}
        </EmptyTitle>
        <EmptyDescription>
          {{ t(emptyDescriptionKey) }}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>

    <template v-else>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <RepositoryCard
          v-for="repository in repositories"
          :key="repository.id || repository.nameWithOwner"
          :repository="repository"
          @select="emit('select', $event)"
        />
      </div>

      <AppPagination
        v-if="showPagination"
        v-model:page="pageModel"
        :disabled="disabled || isLoading"
        hide-when-single-page
        :per-page="perPage"
        summary-key="account.pagination.summary"
        :total-count="totalCount"
      />
    </template>
  </section>
</template>
