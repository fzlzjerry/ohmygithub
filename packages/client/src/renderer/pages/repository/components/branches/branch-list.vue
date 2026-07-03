<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Skeleton,
} from '@oh-my-github/ui'
import AppPagination from '@/components/navigation/app-pagination.vue'
import BranchRow from './branch-row.vue'

const props = defineProps<{
  branches: GitHubBranchListItem[]
  hasError: boolean
  hasIdentity: boolean
  hasNextPage: boolean
  isLoading: boolean
  owner: string
  page: number
  perPage: number
  repo: string
  search: string
  totalCount: number
}>()

const emit = defineEmits<{
  retry: []
  rename: [branch: GitHubBranchListItem]
  delete: [branch: GitHubBranchListItem]
  'update:page': [page: number]
}>()

const { t } = useI18n()

const showLoading = computed(() => props.isLoading && props.branches.length === 0)
const showEmpty = computed(() =>
  props.hasIdentity
  && !props.hasError
  && !props.isLoading
  && props.branches.length === 0
)
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-border bg-card">
    <div class="min-h-[18rem]">
      <div
        v-if="showLoading"
        class="divide-y divide-border"
      >
        <div
          v-for="index in 6"
          :key="index"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4"
        >
          <div class="grid min-w-0 gap-2">
            <Skeleton class="h-4 w-2/5 rounded-md" />
            <Skeleton class="h-3 w-3/5 rounded-md" />
          </div>
          <Skeleton class="hidden h-5 w-24 rounded-md sm:block" />
        </div>
      </div>

      <Empty
        v-else-if="!hasIdentity"
        class="min-h-[18rem] border-0 bg-transparent"
      >
        <EmptyHeader>
          <EmptyTitle>
            {{ t('repository.branches.empty.missingRepositoryTitle') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t('repository.branches.empty.missingRepositoryDescription') }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <Empty
        v-else-if="hasError"
        class="min-h-[18rem] border-0 bg-transparent"
      >
        <EmptyHeader>
          <EmptyTitle>
            {{ t('repository.branches.error.title') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t('repository.branches.error.description') }}
          </EmptyDescription>
          <Button
            class="justify-self-center"
            size="sm"
            type="button"
            variant="outline"
            @click="emit('retry')"
          >
            {{ t('repository.branches.error.retry') }}
          </Button>
        </EmptyHeader>
      </Empty>

      <Empty
        v-else-if="showEmpty"
        class="min-h-[18rem] border-0 bg-transparent"
      >
        <EmptyHeader>
          <EmptyTitle>
            {{ t(search ? 'repository.branches.empty.noMatchesTitle' : 'repository.branches.empty.branchesTitle') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t(search ? 'repository.branches.empty.noMatchesDescription' : 'repository.branches.empty.branchesDescription') }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <div
        v-else
        class="divide-y divide-border"
      >
        <BranchRow
          v-for="branch in branches"
          :key="branch.name"
          :branch="branch"
          :owner="owner"
          :repo="repo"
          @delete="emit('delete', $event)"
          @rename="emit('rename', $event)"
        />
      </div>
    </div>

    <footer class="border-t border-border px-4 py-3">
      <AppPagination
        :disabled="isLoading"
        :has-next-page="hasNextPage"
        :page="page"
        :per-page="perPage"
        summary-key="repository.branches.pagination.branchesSummary"
        :total-count="totalCount"
        @update:page="emit('update:page', $event)"
      />
    </footer>
  </section>
</template>
