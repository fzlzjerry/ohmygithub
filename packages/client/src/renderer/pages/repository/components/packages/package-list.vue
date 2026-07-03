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
import PackageRow from './package-row.vue'

const props = defineProps<{
  disabled?: boolean
  hasError: boolean
  hasIdentity: boolean
  hasNextPage: boolean
  isLoading: boolean
  isScopeError: boolean
  packages: GitHubPackage[]
  page: number
  perPage: number
  totalCount: number
}>()

const emit = defineEmits<{
  delete: [pkg: GitHubPackage]
  retry: []
  viewVersions: [pkg: GitHubPackage]
  'update:page': [page: number]
}>()

const { t } = useI18n()

const showLoading = computed(() => props.isLoading && props.packages.length === 0)
const showEmpty = computed(() =>
  props.hasIdentity
  && !props.hasError
  && !props.isLoading
  && props.packages.length === 0
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
          class="grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-4"
        >
          <Skeleton class="mt-0.5 size-5 rounded-md" />
          <div class="grid min-w-0 gap-2">
            <Skeleton class="h-4 w-4/5 rounded-md" />
            <div class="flex gap-1.5">
              <Skeleton class="h-5 w-14 rounded-full" />
              <Skeleton class="h-5 w-16 rounded-full" />
              <Skeleton class="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <Empty
        v-else-if="!hasIdentity"
        class="min-h-[18rem] border-0 bg-transparent"
      >
        <EmptyHeader>
          <EmptyTitle>
            {{ t('repository.packages.empty.missingRepositoryTitle') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t('repository.packages.empty.missingRepositoryDescription') }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <Empty
        v-else-if="hasError && isScopeError"
        class="min-h-[18rem] border-0 bg-transparent"
      >
        <EmptyHeader>
          <EmptyTitle>
            {{ t('repository.packages.error.scopeTitle') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t('repository.packages.error.scopeDescription') }}
          </EmptyDescription>
          <Button
            class="justify-self-center"
            size="sm"
            type="button"
            variant="outline"
            @click="emit('retry')"
          >
            {{ t('repository.packages.error.retry') }}
          </Button>
        </EmptyHeader>
      </Empty>

      <Empty
        v-else-if="hasError"
        class="min-h-[18rem] border-0 bg-transparent"
      >
        <EmptyHeader>
          <EmptyTitle>
            {{ t('repository.packages.error.title') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t('repository.packages.error.description') }}
          </EmptyDescription>
          <Button
            class="justify-self-center"
            size="sm"
            type="button"
            variant="outline"
            @click="emit('retry')"
          >
            {{ t('repository.packages.error.retry') }}
          </Button>
        </EmptyHeader>
      </Empty>

      <Empty
        v-else-if="showEmpty"
        class="min-h-[18rem] border-0 bg-transparent"
      >
        <EmptyHeader>
          <EmptyTitle>
            {{ t('repository.packages.empty.title') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t('repository.packages.empty.description') }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <div
        v-else
        class="divide-y divide-border"
      >
        <PackageRow
          v-for="pkg in packages"
          :key="pkg.id"
          :package="pkg"
          @delete="emit('delete', $event)"
          @view-versions="emit('viewVersions', $event)"
        />
      </div>
    </div>

    <footer class="border-t border-border px-4 py-3">
      <AppPagination
        :disabled="disabled || isLoading || hasError || !hasIdentity"
        :has-next-page="hasNextPage"
        :page="page"
        :per-page="perPage"
        summary-key="repository.packages.pagination.summary"
        :total-count="totalCount"
        @update:page="emit('update:page', $event)"
      />
    </footer>
  </section>
</template>
