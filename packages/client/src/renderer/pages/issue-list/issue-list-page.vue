<script setup lang="ts">
import type { WorkspaceTab } from '../workspace/types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useIssueCategoryQuery } from '../../composables/github/use-issues'
import { clampPage, filterIssues, paginate } from '../workspace/work-item-list-filter'
import FilterBar from '../repository/components/issues/filter-bar.vue'
import IssueList from '../repository/components/issues/list.vue'

const props = defineProps<{
  tab: WorkspaceTab
}>()

const PER_PAGE = 20

const { t } = useI18n()
const router = useRouter()

const category = computed<GitHubIssueCategory>(() => props.tab.issueCategory ?? 'created-by-me')
const categoryLabel = computed(() => t(`workspace.sidebar.issueCategories.${category.value}`))

const state = ref<GitHubIssueSearchState>('open')
const search = ref('')
const page = ref(1)

const issuesQuery = useIssueCategoryQuery(category, () => true)
const allIssues = computed(() => issuesQuery.data.value ?? [])
const isLoading = computed(() => issuesQuery.isLoading.value)
const hasError = computed(() => Boolean(issuesQuery.error.value))

const filteredIssues = computed(() => filterIssues(allIssues.value, state.value, search.value))
const totalCount = computed(() => filteredIssues.value.length)
const issues = computed(() => paginate(filteredIssues.value, page.value, PER_PAGE))

watch([category, state, search], () => {
  page.value = 1
})

watch(totalCount, (count) => {
  page.value = clampPage(page.value, count, PER_PAGE)
})

function openIssue(issue: GitHubIssue): void {
  void router.push(
    `/${encodeURIComponent(issue.owner)}/${encodeURIComponent(issue.repo)}/issues/${issue.number}`,
  )
}

function refetchIssues(): void {
  void issuesQuery.refetch()
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
          {{ t('issueList.description', { category: categoryLabel }) }}
        </p>
      </div>

      <div class="grid gap-3">
        <FilterBar
          v-model:search="search"
          v-model:state="state"
        />

        <IssueList
          :has-error="hasError"
          :has-identity="true"
          :incomplete-results="false"
          :is-loading="isLoading"
          :issues="issues"
          :page="page"
          :per-page="PER_PAGE"
          :search="search"
          :state="state"
          :total-count="totalCount"
          @retry="refetchIssues"
          @select="openIssue"
          @update:page="page = $event"
        />
      </div>
    </div>
  </section>
</template>
