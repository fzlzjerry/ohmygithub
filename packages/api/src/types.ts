export type GitHubItemKind = 'notification' | 'pull_request' | 'issue' | 'action'

export type GitHubItemState = 'open' | 'closed' | 'merged' | 'failed' | 'success' | 'unread'

export interface GitHubActor {
  login: string
  avatarUrl?: string
}

export interface GitHubAuthViewer {
  id: number
  login: string
  name: string | null
  avatarUrl: string
}

export interface GitHubOrganization {
  id: number
  login: string
  avatarUrl: string
  description: string | null
}

export interface GitHubRepository {
  id: number
  name: string
  nameWithOwner: string
  owner: string
  description: string | null
  isPrivate: boolean
  updatedAt: string
  url: string
}

export type GitHubCiState = 'pending' | 'success' | 'failure'

export type GitHubPullRequestState =
  | 'draft'
  | 'merged'
  | 'open'
  | 'cannot_merge'

export type GitHubIssueState =
  | 'open'
  | 'completed'
  | 'not_planned'

export type GitHubPullRequestCategory =
  | 'created-by-me'
  | 'needs-review'
  | 'inbox'
  | 'mentioned-me'

export type GitHubIssueCategory =
  | 'created-by-me'
  | 'inbox'
  | 'mentioned-me'

export interface GitHubPullRequest {
  id: string
  owner: string
  repo: string
  repository: string
  number: number
  title: string
  state: GitHubPullRequestState
  ciState: GitHubCiState | null
  author: GitHubActor
  updatedAt: string
  labels: string[]
  url: string
  hasUpdates: boolean
}

export interface GitHubIssue {
  id: string
  owner: string
  repo: string
  repository: string
  number: number
  title: string
  state: GitHubIssueState
  author: GitHubActor
  updatedAt: string
  labels: string[]
  url: string
  hasUpdates: boolean
}

export interface GitHubDeviceAuthorization {
  deviceCode: string
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
  expiresIn: number
  interval: number
}

export type GitHubDeviceTokenPendingState =
  | 'authorization_pending'
  | 'slow_down'

export type GitHubDeviceTokenFailureState =
  | 'access_denied'
  | 'expired_token'
  | 'incorrect_client_credentials'
  | 'incorrect_device_code'
  | 'unknown_error'

export type GitHubDeviceTokenResult =
  | {
      status: 'success'
      accessToken: string
      tokenType: string
      scopes: string[]
    }
  | {
      status: 'pending'
      reason: GitHubDeviceTokenPendingState
      interval?: number
    }
  | {
      status: 'failure'
      reason: GitHubDeviceTokenFailureState
      description?: string
    }

export interface GitHubWorkspaceItem {
  id: string
  kind: GitHubItemKind
  title: string
  repository: string
  number?: number
  state: GitHubItemState
  author: GitHubActor
  updatedAt: string
  labels: string[]
  summary: string
  url?: string
}

export interface GitHubClient {
  listNotifications(): Promise<GitHubWorkspaceItem[]>
  listPullRequests(): Promise<GitHubWorkspaceItem[]>
  listIssues(): Promise<GitHubWorkspaceItem[]>
  listPullRequestCategory(options: ListPullRequestCategoryOptions): Promise<GitHubPullRequest[]>
  listViewerPullRequests(options?: ListWorkspaceItemsOptions): Promise<GitHubPullRequest[]>
  listRepositoryPullRequests(options: ListRepositoryWorkspaceItemsOptions): Promise<GitHubPullRequest[]>
  listIssueCategory(options: ListIssueCategoryOptions): Promise<GitHubIssue[]>
  listViewerIssues(options?: ListWorkspaceItemsOptions): Promise<GitHubIssue[]>
  listRepositoryIssues(options: ListRepositoryWorkspaceItemsOptions): Promise<GitHubIssue[]>
  listViewerOrganizations(): Promise<GitHubOrganization[]>
  listOrganizationRepositories(owner: string): Promise<GitHubRepository[]>
}

export interface GitHubApiOptions {
  token: string
  baseUrl?: string
  proxyUrl?: string
  userAgent?: string
}

export interface StartDeviceAuthorizationOptions {
  clientId: string
  scopes: string[]
}

export interface PollDeviceAccessTokenOptions {
  clientId: string
  deviceCode: string
}

export interface ListWorkspaceItemsOptions {
  limit?: number
}

export interface ListPullRequestCategoryOptions extends ListWorkspaceItemsOptions {
  category: GitHubPullRequestCategory
}

export interface ListIssueCategoryOptions extends ListWorkspaceItemsOptions {
  category: GitHubIssueCategory
}

export interface ListRepositoryWorkspaceItemsOptions extends ListWorkspaceItemsOptions {
  owner: string
  repo: string
}
