import type { GitHubOctokit } from '../transport'
import type {
  GitHubCiState,
  GitHubPullRequest,
  GitHubPullRequestState,
  ListPullRequestCategoryOptions,
  ListRepositoryWorkspaceItemsOptions,
  ListWorkspaceItemsOptions
} from '../types'
import {
  createWorkItemKey,
  listInboxWorkItemReferences,
  listUnreadWorkItemKeys,
  mapLabels,
  normalizeActor,
  normalizeLimit,
  splitRepositoryName,
  type GraphQLWorkItemBase
} from './work-items'

interface GraphQLPullRequestNode extends GraphQLWorkItemBase {
  isDraft: boolean
  merged: boolean
  mergeable?: string | null
  mergeStateStatus?: string | null
  statusCheckRollup?: {
    state?: string | null
  } | null
}

interface ViewerPullRequestsResponse {
  search: {
    nodes?: Array<GraphQLPullRequestNode | null> | null
  }
}

interface RepositoryPullRequestsResponse {
  repository: {
    pullRequests: {
      nodes?: Array<GraphQLPullRequestNode | null> | null
    }
  } | null
}

interface PullRequestByNumberResponse {
  repository: {
    pullRequest: GraphQLPullRequestNode | null
  } | null
}

const pullRequestFields = `
  fragment PullRequestFields on PullRequest {
    id
    title
    number
    state
    url
    updatedAt
    isDraft
    merged
    mergeable
    mergeStateStatus
    author {
      login
      avatarUrl
    }
    repository {
      nameWithOwner
    }
    labels(first: 8) {
      nodes {
        name
      }
    }
    statusCheckRollup {
      state
    }
  }
`

const viewerPullRequestsQuery = `
  query ViewerPullRequests($searchQuery: String!, $first: Int!) {
    search(query: $searchQuery, type: ISSUE, first: $first) {
      nodes {
        ...PullRequestFields
      }
    }
  }

  ${pullRequestFields}
`

const repositoryPullRequestsQuery = `
  query RepositoryPullRequests($owner: String!, $repo: String!, $first: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: $first, states: [OPEN], orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          ...PullRequestFields
        }
      }
    }
  }

  ${pullRequestFields}
`

const pullRequestByNumberQuery = `
  query PullRequestByNumber($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        ...PullRequestFields
      }
    }
  }

  ${pullRequestFields}
`

export class PullsApi {
  constructor(private readonly octokit: GitHubOctokit) {}

  async listPullRequestCategory(options: ListPullRequestCategoryOptions): Promise<GitHubPullRequest[]> {
    const limit = normalizeLimit(options.limit)
    const { data: viewer } = await this.octokit.rest.users.getAuthenticated()

    if (options.category === 'inbox') {
      const references = await listInboxWorkItemReferences(this.octokit, 'pull-request')
      const unreadKeys = await listUnreadWorkItemKeys(this.octokit)
      const nodes = await Promise.all(
        references.map((reference) => this.fetchPullRequestByReference(reference).catch(() => null))
      )

      return dedupePullRequests(mapPullRequestNodes(nodes.filter(isOpenPullRequestNode), unreadKeys)).slice(0, limit)
    }

    return this.searchPullRequests(categorySearchQuery(options.category, viewer.login), limit)
  }

  async listViewerPullRequests(options: ListWorkspaceItemsOptions = {}): Promise<GitHubPullRequest[]> {
    const limit = normalizeLimit(options.limit)
    const { data: viewer } = await this.octokit.rest.users.getAuthenticated()
    return this.searchPullRequests(
      `is:pr is:open archived:false involves:${viewer.login} sort:updated-desc`,
      limit
    )
  }

  async listRepositoryPullRequests(options: ListRepositoryWorkspaceItemsOptions): Promise<GitHubPullRequest[]> {
    const limit = normalizeLimit(options.limit)
    const response = await this.octokit.graphql<RepositoryPullRequestsResponse>(
      repositoryPullRequestsQuery,
      {
        owner: options.owner,
        repo: options.repo,
        first: limit
      }
    )
    const unreadKeys = await listUnreadWorkItemKeys(this.octokit)

    return mapPullRequestNodes(response.repository?.pullRequests.nodes, unreadKeys)
  }

  private async searchPullRequests(searchQuery: string, limit: number): Promise<GitHubPullRequest[]> {
    const response = await this.octokit.graphql<ViewerPullRequestsResponse>(
      viewerPullRequestsQuery,
      {
        first: limit,
        searchQuery
      }
    )
    const unreadKeys = await listUnreadWorkItemKeys(this.octokit)

    return dedupePullRequests(mapPullRequestNodes(response.search.nodes, unreadKeys))
  }

  private async fetchPullRequestByReference(reference: {
    owner: string
    repo: string
    number: number
  }): Promise<GraphQLPullRequestNode | null> {
    const response = await this.octokit.graphql<PullRequestByNumberResponse>(
      pullRequestByNumberQuery,
      {
        owner: reference.owner,
        repo: reference.repo,
        number: reference.number
      }
    )

    return response.repository?.pullRequest ?? null
  }
}

function isOpenPullRequestNode(node: GraphQLPullRequestNode | null): node is GraphQLPullRequestNode {
  return Boolean(node) && node?.state === 'OPEN'
}

function categorySearchQuery(category: ListPullRequestCategoryOptions['category'], login: string): string {
  if (category === 'created-by-me') {
    return `is:pr is:open archived:false author:${login} sort:updated-desc`
  }

  if (category === 'needs-review') {
    return `is:pr is:open archived:false review-requested:${login} sort:updated-desc`
  }

  return `is:pr is:open archived:false mentions:${login} sort:updated-desc`
}

function mapPullRequestNodes(
  nodes: Array<GraphQLPullRequestNode | null> | null | undefined,
  unreadKeys: Set<string>
): GitHubPullRequest[] {
  return (nodes ?? []).flatMap((node) => {
    if (!node) return []

    const repository = splitRepositoryName(node.repository.nameWithOwner)

    return [
      {
        id: `pull-request:${node.id}`,
        owner: repository.owner,
        repo: repository.repo,
        repository: repository.repository,
        number: node.number,
        title: node.title,
        state: normalizePullRequestState(node),
        ciState: normalizeCiState(node.statusCheckRollup?.state),
        author: normalizeActor(node.author),
        updatedAt: node.updatedAt,
        labels: mapLabels(node.labels),
        url: node.url,
        hasUpdates: unreadKeys.has(createWorkItemKey('pull-request', repository.repository, node.number))
      }
    ]
  })
}

function dedupePullRequests(pullRequests: GitHubPullRequest[]): GitHubPullRequest[] {
  const seen = new Set<string>()
  const result: GitHubPullRequest[] = []

  for (const pullRequest of pullRequests) {
    const key = createWorkItemKey('pull-request', pullRequest.repository, pullRequest.number)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(pullRequest)
  }

  return result
}

function normalizePullRequestState(node: GraphQLPullRequestNode): GitHubPullRequestState {
  if (node.isDraft) return 'draft'
  if (node.merged || node.state === 'MERGED') return 'merged'
  if (node.mergeable === 'CONFLICTING' || node.mergeStateStatus === 'BLOCKED' || node.mergeStateStatus === 'DIRTY') {
    return 'cannot_merge'
  }

  return 'open'
}

function normalizeCiState(value: string | null | undefined): GitHubCiState | null {
  if (value === 'SUCCESS') return 'success'
  if (value === 'FAILURE' || value === 'ERROR') return 'failure'
  if (value === 'PENDING' || value === 'EXPECTED') return 'pending'

  return null
}
