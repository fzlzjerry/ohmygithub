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
import TagRow from './tag-row.vue'

const props = defineProps<{
  tags: GitHubTagListItem[]
  hasError: boolean
  hasIdentity: boolean
  hasNextPage: boolean
  isLoading: boolean
  page: number
  perPage: number
  search: string
  totalCount: number
}>()

const emit = defineEmits<{
  retry: []
  delete: [tag: GitHubTagListItem]
  'update:page': [page: number]
}>()

const { t } = useI18n()

const showLoading = computed(() => props.isLoading && props.tags.length === 0)
const showEmpty = computed(() =>
  props.hasIdentity
  && !props.hasError
  && !props.isLoading
  && props.tags.length === 0
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
            <Skeleton class="h-4 w-1/4 rounded-md" />
            <Skeleton class="h-3 w-1/2 rounded-md" />
          </div>
          <Skeleton class="size-6 rounded-md" />
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
            {{ t(search ? 'repository.branches.empty.noMatchesTitle' : 'repository.branches.empty.tagsTitle') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t(search ? 'repository.branches.empty.noMatchesDescription' : 'repository.branches.empty.tagsDescription') }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <div
        v-else
        class="divide-y divide-border"
      >
        <TagRow
          v-for="tag in tags"
          :key="tag.name"
          :tag="tag"
          @delete="emit('delete', $event)"
        />
      </div>
    </div>

    <footer class="border-t border-border px-4 py-3">
      <AppPagination
        :disabled="isLoading"
        :has-next-page="hasNextPage"
        :page="page"
        :per-page="perPage"
        summary-key="repository.branches.pagination.tagsSummary"
        :total-count="totalCount"
        @update:page="emit('update:page', $event)"
      />
    </footer>
  </section>
</template>
