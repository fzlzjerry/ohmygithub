import type { GitHubOctokit } from '../transport'
import type {
  GitHubIssue,
  GitHubIssueState,
  ListIssueCategoryOptions,
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

interface GraphQLIssueNode extends GraphQLWorkItemBase {
  stateReason?: string | null
}

interface ViewerIssuesResponse {
  search: {
    nodes?: Array<GraphQLIssueNode | null> | null
  }
}

interface RepositoryIssuesResponse {
  repository: {
    issues: {
      nodes?: Array<GraphQLIssueNode | null> | null
    }
  } | null
}

interface IssueByNumberResponse {
  repository: {
    issue: GraphQLIssueNode | null
  } | null
}

const issueFields = `
  fragment IssueFields on Issue {
    id
    title
    number
    state
    stateReason
    url
    updatedAt
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
  }
`

const viewerIssuesQuery = `
  query ViewerIssues($searchQuery: String!, $first: Int!) {
    search(query: $searchQuery, type: ISSUE, first: $first) {
      nodes {
        ...IssueFields
      }
    }
  }

  ${issueFields}
`

const repositoryIssuesQuery = `
  query RepositoryIssues($owner: String!, $repo: String!, $first: Int!) {
    repository(owner: $owner, name: $repo) {
      issues(first: $first, states: [OPEN], orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          ...IssueFields
        }
      }
    }
  }

  ${issueFields}
`

const issueByNumberQuery = `
  query IssueByNumber($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        ...IssueFields
      }
    }
  }

  ${issueFields}
`

export class IssuesApi {
  constructor(private readonly octokit: GitHubOctokit) {}

  async listIssueCategory(options: ListIssueCategoryOptions): Promise<GitHubIssue[]> {
    const limit = normalizeLimit(options.limit)
    const { data: viewer } = await this.octokit.rest.users.getAuthenticated()

    if (options.category === 'inbox') {
      const references = await listInboxWorkItemReferences(this.octokit, 'issue')
      const unreadKeys = await listUnreadWorkItemKeys(this.octokit)
      const nodes = await Promise.all(
        references.map((reference) => this.fetchIssueByReference(reference).catch(() => null))
      )

      return dedupeIssues(mapIssueNodes(nodes.filter(isOpenIssueNode), unreadKeys)).slice(0, limit)
    }

    return this.searchIssues(categorySearchQuery(options.category, viewer.login), limit)
  }

  async listViewerIssues(options: ListWorkspaceItemsOptions = {}): Promise<GitHubIssue[]> {
    const limit = normalizeLimit(options.limit)
    const { data: viewer } = await this.octokit.rest.users.getAuthenticated()
    return this.searchIssues(
      `is:issue is:open archived:false involves:${viewer.login} sort:updated-desc`,
      limit
    )
  }

  async listRepositoryIssues(options: ListRepositoryWorkspaceItemsOptions): Promise<GitHubIssue[]> {
    const limit = normalizeLimit(options.limit)
    const response = await this.octokit.graphql<RepositoryIssuesResponse>(
      repositoryIssuesQuery,
      {
        owner: options.owner,
        repo: options.repo,
        first: limit
      }
    )
    const unreadKeys = await listUnreadWorkItemKeys(this.octokit)

    return mapIssueNodes(response.repository?.issues.nodes, unreadKeys)
  }

  private async searchIssues(searchQuery: string, limit: number): Promise<GitHubIssue[]> {
    const response = await this.octokit.graphql<ViewerIssuesResponse>(
      viewerIssuesQuery,
      {
        first: limit,
        searchQuery
      }
    )
    const unreadKeys = await listUnreadWorkItemKeys(this.octokit)

    return dedupeIssues(mapIssueNodes(response.search.nodes, unreadKeys))
  }

  private async fetchIssueByReference(reference: {
    owner: string
    repo: string
    number: number
  }): Promise<GraphQLIssueNode | null> {
    const response = await this.octokit.graphql<IssueByNumberResponse>(
      issueByNumberQuery,
      {
        owner: reference.owner,
        repo: reference.repo,
        number: reference.number
      }
    )

    return response.repository?.issue ?? null
  }
}

function isOpenIssueNode(node: GraphQLIssueNode | null): node is GraphQLIssueNode {
  return Boolean(node) && node?.state === 'OPEN'
}

function categorySearchQuery(category: ListIssueCategoryOptions['category'], login: string): string {
  if (category === 'created-by-me') {
    return `is:issue is:open archived:false author:${login} sort:updated-desc`
  }

  return `is:issue is:open archived:false mentions:${login} sort:updated-desc`
}

function mapIssueNodes(
  nodes: Array<GraphQLIssueNode | null> | null | undefined,
  unreadKeys: Set<string>
): GitHubIssue[] {
  return (nodes ?? []).flatMap((node) => {
    if (!node) return []

    const repository = splitRepositoryName(node.repository.nameWithOwner)

    return [
      {
        id: `issue:${node.id}`,
        owner: repository.owner,
        repo: repository.repo,
        repository: repository.repository,
        number: node.number,
        title: node.title,
        state: normalizeIssueState(node),
        author: normalizeActor(node.author),
        updatedAt: node.updatedAt,
        labels: mapLabels(node.labels),
        url: node.url,
        hasUpdates: unreadKeys.has(createWorkItemKey('issue', repository.repository, node.number))
      }
    ]
  })
}

function dedupeIssues(issues: GitHubIssue[]): GitHubIssue[] {
  const seen = new Set<string>()
  const result: GitHubIssue[] = []

  for (const issue of issues) {
    const key = createWorkItemKey('issue', issue.repository, issue.number)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(issue)
  }

  return result
}

function normalizeIssueState(node: GraphQLIssueNode): GitHubIssueState {
  if (node.state !== 'CLOSED') return 'open'
  if (node.stateReason === 'COMPLETED') return 'completed'

  return 'not_planned'
}
