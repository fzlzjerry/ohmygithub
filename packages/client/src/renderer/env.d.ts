/// <reference types="vite/client" />

type LocalConfig = {
  schemaVersion: 1
  github: {
    activeAccountLogin: string | null
  }
  network: {
    proxyUrl: string | null
  }
  ui: {
    locale: 'en' | 'zh'
    theme: 'auto' | 'light' | 'dark'
  }
}

type AuthViewer = {
  id: number
  login: string
  name: string | null
  avatarUrl: string
}

type GitHubOrganization = {
  id: number
  login: string
  avatarUrl: string
  description: string | null
}

type GitHubRepository = {
  id: number
  name: string
  nameWithOwner: string
  owner: string
  description: string | null
  isPrivate: boolean
  updatedAt: string
  url: string
}

type GitHubCiState = 'pending' | 'success' | 'failure'

type GitHubPullRequestState = 'draft' | 'merged' | 'open' | 'cannot_merge'

type GitHubIssueState = 'open' | 'completed' | 'not_planned'

type GitHubPullRequestCategory = 'created-by-me' | 'needs-review' | 'inbox' | 'mentioned-me'

type GitHubIssueCategory = 'created-by-me' | 'inbox' | 'mentioned-me'

type GitHubActor = {
  login: string
  avatarUrl?: string
}

type GitHubPullRequest = {
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

type GitHubIssue = {
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

type AuthState = {
  isAuthenticated: boolean
  path: string
  hasGitHubClientId: boolean
  auth: {
    schemaVersion: 1
    method: 'oauth_device' | 'personal_token'
    tokenType: string
    scopes: string[]
    viewer: AuthViewer
    createdAt: string
    updatedAt: string
  } | null
}

type WindowControlsState = {
  isFullScreen: boolean
}

interface Window {
  ohMyGithub: {
    app: {
      name: string
      version: string
    }
    accounts: {
      listOrganizations: () => Promise<GitHubOrganization[]>
      listOrganizationRepositories: (owner: string) => Promise<GitHubRepository[]>
    }
    issues: {
      listIssueCategory: (category: GitHubIssueCategory) => Promise<GitHubIssue[]>
      listViewerIssues: () => Promise<GitHubIssue[]>
      listRepositoryIssues: (owner: string, repo: string) => Promise<GitHubIssue[]>
    }
    pulls: {
      listPullRequestCategory: (category: GitHubPullRequestCategory) => Promise<GitHubPullRequest[]>
      listViewerPullRequests: () => Promise<GitHubPullRequest[]>
      listRepositoryPullRequests: (owner: string, repo: string) => Promise<GitHubPullRequest[]>
    }
    auth: {
      get: () => Promise<AuthState>
      startDeviceFlow: (onStarted?: (details: {
        auth: AuthState
        sessionId: string
        userCode: string
        verificationUri: string
        verificationUriComplete?: string
      }) => void) => Promise<{
        auth: AuthState
        sessionId: string
        userCode: string
        verificationUri: string
        verificationUriComplete?: string
      }>
      copyCodeAndOpenDeviceFlow: (sessionId: string) => Promise<void>
      savePersonalToken: (token: string) => Promise<AuthState>
      logout: () => Promise<AuthState>
    }
    config: {
      get: () => Promise<{
        path: string
        config: LocalConfig
      }>
      update: (patch: Partial<{
        github: Partial<LocalConfig['github']>
        network: Partial<LocalConfig['network']>
        ui: Partial<LocalConfig['ui']>
      }>) => Promise<{
        path: string
        config: LocalConfig
      }>
    }
    windowControls: {
      getState: () => Promise<WindowControlsState>
      onFullscreenChange: (listener: (state: WindowControlsState) => void) => () => void
    }
  }
}
