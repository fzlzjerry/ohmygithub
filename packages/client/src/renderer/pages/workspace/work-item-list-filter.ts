/**
 * Client-side filtering and pagination for workspace category lists.
 *
 * The pull-request / issue category endpoints return a flat array without
 * server-side state filtering, search, or pagination. These helpers reproduce
 * the behaviour of the repository tab's search query on the client so the same
 * list + pagination components can be reused for the category list pages.
 */

interface WorkItemSearchTarget {
  number: number
  title: string
}

export function matchesPullRequestState(
  state: GitHubPullRequestState,
  filter: GitHubPullRequestSearchState,
): boolean {
  if (filter === 'all') return true
  if (filter === 'closed') return state === 'closed' || state === 'merged'

  return state === 'open' || state === 'draft'
}

export function matchesIssueState(
  state: GitHubIssueState,
  filter: GitHubIssueSearchState,
): boolean {
  if (filter === 'all') return true
  if (filter === 'closed') return state === 'completed' || state === 'not_planned'

  return state === 'open'
}

export function matchesWorkItemSearch(item: WorkItemSearchTarget, search: string): boolean {
  const query = search.trim().toLowerCase()
  if (!query) return true

  const normalizedQuery = query.startsWith('#') ? query.slice(1) : query

  return item.title.toLowerCase().includes(query)
    || String(item.number).includes(normalizedQuery)
}

export function filterPullRequests(
  pullRequests: readonly GitHubPullRequest[],
  state: GitHubPullRequestSearchState,
  search: string,
): GitHubPullRequest[] {
  return pullRequests.filter(
    (pullRequest) =>
      matchesPullRequestState(pullRequest.state, state)
      && matchesWorkItemSearch(pullRequest, search),
  )
}

export function filterIssues(
  issues: readonly GitHubIssue[],
  state: GitHubIssueSearchState,
  search: string,
): GitHubIssue[] {
  return issues.filter(
    (issue) => matchesIssueState(issue.state, state) && matchesWorkItemSearch(issue, search),
  )
}

export function pageCount(totalCount: number, perPage: number): number {
  if (perPage <= 0) return 1

  return Math.max(1, Math.ceil(totalCount / perPage))
}

export function clampPage(page: number, totalCount: number, perPage: number): number {
  const lastPage = pageCount(totalCount, perPage)

  if (!Number.isFinite(page) || page < 1) return 1
  if (page > lastPage) return lastPage

  return Math.floor(page)
}

export function paginate<T>(items: readonly T[], page: number, perPage: number): T[] {
  if (perPage <= 0) return [...items]

  const safePage = Math.max(1, Math.floor(page))
  const start = (safePage - 1) * perPage

  return items.slice(start, start + perPage)
}
