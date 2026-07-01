<script setup lang="ts">
import type { WorkspaceTab } from '../workspace/types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { usePullRequestCategoryQuery } from '../../composables/github/use-pull-requests'
import { clampPage, filterPullRequests, paginate } from '../workspace/work-item-list-filter'
import FilterBar from '../repository/components/pulls/filter-bar.vue'
import PullRequestList from '../repository/components/pulls/list.vue'

const props = defineProps<{
  tab: WorkspaceTab
}>()

const PER_PAGE = 20

const { t } = useI18n()
const router = useRouter()

const category = computed<GitHubPullRequestCategory>(() => props.tab.pullRequestCategory ?? 'created-by-me')
const categoryLabel = computed(() => t(`workspace.sidebar.pullRequestCategories.${category.value}`))

const state = ref<GitHubPullRequestSearchState>('open')
const search = ref('')
const page = ref(1)

const pullRequestsQuery = usePullRequestCategoryQuery(category, () => true)
const allPullRequests = computed(() => pullRequestsQuery.data.value ?? [])
const isLoading = computed(() => pullRequestsQuery.isLoading.value)
const hasError = computed(() => Boolean(pullRequestsQuery.error.value))

const filteredPullRequests = computed(() => filterPullRequests(allPullRequests.value, state.value, search.value))
const totalCount = computed(() => filteredPullRequests.value.length)
const pullRequests = computed(() => paginate(filteredPullRequests.value, page.value, PER_PAGE))

watch([category, state, search], () => {
  page.value = 1
})

watch(totalCount, (count) => {
  page.value = clampPage(page.value, count, PER_PAGE)
})

function openPullRequest(pullRequest: GitHubPullRequest): void {
  void router.push(
    `/${encodeURIComponent(pullRequest.owner)}/${encodeURIComponent(pullRequest.repo)}/pull/${pullRequest.number}`,
  )
}

function refetchPullRequests(): void {
  void pullRequestsQuery.refetch()
}
</script>

<template>
  <section class="min-h-full bg-background">
    <div class="mx-auto grid w-full max-w-5xl gap-5 px-6 py-6">
      <div class="grid max-w-3xl gap-2">
        <h1 class="select-none truncate text-heading font-semibold text-foreground">
          {{ categoryLabel }}
        </h1>
        <p class="max-w-2xl select-none text-label text-muted-foreground">
          {{ t('pullRequestList.description', { category: categoryLabel }) }}
        </p>
      </div>

      <div class="grid gap-3">
        <FilterBar
          v-model:search="search"
          v-model:state="state"
        />

        <PullRequestList
          :has-error="hasError"
          :has-identity="true"
          :incomplete-results="false"
          :is-loading="isLoading"
          :page="page"
          :per-page="PER_PAGE"
          :pull-requests="pullRequests"
          :search="search"
          :state="state"
          :total-count="totalCount"
          @retry="refetchPullRequests"
          @select="openPullRequest"
          @update:page="page = $event"
        />
      </div>
    </div>
  </section>
</template>
