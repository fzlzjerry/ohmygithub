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
import VersionRow from './version-row.vue'

const props = defineProps<{
  disabled?: boolean
  hasError: boolean
  hasNextPage: boolean
  isLoading: boolean
  page: number
  perPage: number
  totalCount: number
  versions: GitHubPackageVersion[]
}>()

const emit = defineEmits<{
  delete: [version: GitHubPackageVersion]
  retry: []
  'update:page': [page: number]
}>()

const { t } = useI18n()

const showLoading = computed(() => props.isLoading && props.versions.length === 0)
const showEmpty = computed(() => !props.hasError && !props.isLoading && props.versions.length === 0)
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
          class="grid gap-3 p-4"
        >
          <Skeleton class="h-4 w-2/5 rounded-md" />
          <div class="flex gap-1.5">
            <Skeleton class="h-5 w-14 rounded-full" />
            <Skeleton class="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>

      <Empty
        v-else-if="hasError"
        class="min-h-[18rem] border-0 bg-transparent"
      >
        <EmptyHeader>
          <EmptyTitle>
            {{ t('repository.packages.versions.error.title') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t('repository.packages.versions.error.description') }}
          </EmptyDescription>
          <Button
            class="justify-self-center"
            size="sm"
            type="button"
            variant="outline"
            @click="emit('retry')"
          >
            {{ t('repository.packages.versions.error.retry') }}
          </Button>
        </EmptyHeader>
      </Empty>

      <Empty
        v-else-if="showEmpty"
        class="min-h-[18rem] border-0 bg-transparent"
      >
        <EmptyHeader>
          <EmptyTitle>
            {{ t('repository.packages.versions.empty.title') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t('repository.packages.versions.empty.description') }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <div
        v-else
        class="divide-y divide-border"
      >
        <VersionRow
          v-for="version in versions"
          :key="version.id"
          :version="version"
          @delete="emit('delete', $event)"
        />
      </div>
    </div>

    <footer class="border-t border-border px-4 py-3">
      <AppPagination
        :disabled="disabled || isLoading || hasError"
        :has-next-page="hasNextPage"
        :page="page"
        :per-page="perPage"
        summary-key="repository.packages.versions.pagination.summary"
        :total-count="totalCount"
        @update:page="emit('update:page', $event)"
      />
    </footer>
  </section>
</template>
