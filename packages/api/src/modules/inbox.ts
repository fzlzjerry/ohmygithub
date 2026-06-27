import type { GitHubOctokit } from '../transport'
import type { GitHubItemKind, GitHubItemState, GitHubWorkspaceItem, ListWorkspaceItemsOptions } from '../types'

type GraphQLActor = {
  login: string
  avatarUrl?: string | null
} | null

interface GraphQLLabelConnection {
  nodes?: Array<{ name: string } | null> | null
}

interface GraphQLRepository {
  nameWithOwner: string
  url?: string
}

interface GraphQLWorkItemNode {
  id: string
  title: string
  number: number
  state: string
  url: string
  updatedAt: string
  author: GraphQLActor
  repository: GraphQLRepository
  labels?: GraphQLLabelConnection | null
}

interface ViewerWorkItemsResponse {
  viewer: {
    pullRequests: {
      nodes?: Array<GraphQLWorkItemNode | null> | null
    }
    issues: {
      nodes?: Array<GraphQLWorkItemNode | null> | null
    }
  }
}

const viewerWorkItemsQuery = `
  query ViewerWorkItems($first: Int!) {
    viewer {
      pullRequests(first: $first, states: [OPEN], orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          id
          title
          number
          state
          url
          updatedAt
          author {
            login
            avatarUrl
          }
          repository {
            nameWithOwner
            url
          }
          labels(first: 8) {
            nodes {
              name
            }
          }
        }
      }
      issues(first: $first, states: [OPEN], orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          id
          title
          number
          state
          url
          updatedAt
          author {
            login
            avatarUrl
          }
          repository {
            nameWithOwner
            url
          }
          labels(first: 8) {
            nodes {
              name
            }
          }
        }
      }
    }
  }
`

export class InboxApi {
  constructor(private readonly octokit: GitHubOctokit) {}

  async listWorkspaceItems(options: ListWorkspaceItemsOptions = {}): Promise<GitHubWorkspaceItem[]> {
    const [notifications, pullRequests, issues] = await Promise.all([
      this.listNotifications(options),
      this.listPullRequests(options),
      this.listIssues(options)
    ])

    return [...notifications, ...pullRequests, ...issues].sort((a, b) => {
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    })
  }

  async listNotifications(options: ListWorkspaceItemsOptions = {}): Promise<GitHubWorkspaceItem[]> {
    const limit = options.limit ?? 50
    const notifications = await this.octokit.paginate(
      this.octokit.rest.activity.listNotificationsForAuthenticatedUser,
      {
        all: false,
        per_page: Math.min(limit, 100)
      }
    )

    return notifications.slice(0, limit).map((notification) => {
      const repository = notification.repository.full_name
      const title = notification.subject.title
      const kind = notificationKind(notification.subject.type)

      return {
        id: `notification:${notification.id}`,
        kind,
        title,
        repository,
        number: parseSubjectNumber(notification.subject.url),
        state: notification.unread ? 'unread' : 'open',
        author: {
          login: notification.reason
        },
        updatedAt: notification.updated_at,
        labels: [notification.reason],
        summary: notification.subject.type,
        url: notification.repository.html_url
      }
    })
  }

  async listPullRequests(options: ListWorkspaceItemsOptions = {}): Promise<GitHubWorkspaceItem[]> {
    const response = await this.fetchViewerWorkItems(options)
    return mapGraphQLNodes(response.viewer.pullRequests.nodes, 'pull_request')
  }

  async listIssues(options: ListWorkspaceItemsOptions = {}): Promise<GitHubWorkspaceItem[]> {
    const response = await this.fetchViewerWorkItems(options)
    return mapGraphQLNodes(response.viewer.issues.nodes, 'issue')
  }

  private async fetchViewerWorkItems(
    options: ListWorkspaceItemsOptions = {}
  ): Promise<ViewerWorkItemsResponse> {
    return this.octokit.graphql<ViewerWorkItemsResponse>(viewerWorkItemsQuery, {
      first: Math.min(options.limit ?? 50, 100)
    })
  }
}

function mapGraphQLNodes(
  nodes: Array<GraphQLWorkItemNode | null> | null | undefined,
  kind: Extract<GitHubItemKind, 'pull_request' | 'issue'>
): GitHubWorkspaceItem[] {
  return (nodes ?? []).flatMap((node) => {
    if (!node) {
      return []
    }

    return [
      {
        id: `${kind}:${node.id}`,
        kind,
        title: node.title,
        repository: node.repository.nameWithOwner,
        number: node.number,
        state: normalizeState(node.state),
        author: {
          login: node.author?.login ?? 'unknown',
          avatarUrl: node.author?.avatarUrl ?? undefined
        },
        updatedAt: node.updatedAt,
        labels: (node.labels?.nodes ?? []).flatMap((label) => (label?.name ? [label.name] : [])),
        summary: node.repository.nameWithOwner,
        url: node.url
      }
    ]
  })
}

function notificationKind(subjectType: string): GitHubItemKind {
  if (subjectType === 'PullRequest') {
    return 'pull_request'
  }

  if (subjectType === 'Issue') {
    return 'issue'
  }

  if (subjectType === 'CheckSuite' || subjectType === 'WorkflowRun') {
    return 'action'
  }

  return 'notification'
}

function normalizeState(value: string): GitHubItemState {
  if (value === 'MERGED') {
    return 'merged'
  }

  if (value === 'CLOSED') {
    return 'closed'
  }

  return 'open'
}

function parseSubjectNumber(url: string | undefined): number | undefined {
  const match = url?.match(/\/(?:issues|pulls)\/(\d+)$/)
  return match ? Number(match[1]) : undefined
}
