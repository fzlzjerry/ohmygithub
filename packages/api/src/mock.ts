import type {
  GitHubClient,
  GitHubIssue,
  GitHubOrganization,
  GitHubPullRequest,
  GitHubRepository,
  GitHubWorkspaceItem,
  ListIssueCategoryOptions,
  ListPullRequestCategoryOptions,
  ListRepositoryWorkspaceItemsOptions
} from './types'

const items: GitHubWorkspaceItem[] = [
  {
    id: 'notif-1',
    kind: 'notification',
    title: 'Review requested on electron shell navigation',
    repository: 'oh-my-github/client',
    number: 18,
    state: 'unread',
    author: { login: 'octo-lina' },
    updatedAt: '2026-06-27T08:42:00.000Z',
    labels: ['review', 'desktop'],
    summary: 'A reviewer asked for tighter keyboard behavior in the workspace sidebar.'
  },
  {
    id: 'pr-1',
    kind: 'pull_request',
    title: 'Add notification grouping model',
    repository: 'oh-my-github/api',
    number: 21,
    state: 'open',
    author: { login: 'maya' },
    updatedAt: '2026-06-27T07:10:00.000Z',
    labels: ['api', 'inbox'],
    summary: 'Introduces an inbox-oriented shape for notifications, issues, and pull requests.'
  },
  {
    id: 'issue-1',
    kind: 'issue',
    title: 'Design empty state for first-run workspace',
    repository: 'oh-my-github/ui',
    number: 7,
    state: 'open',
    author: { login: 'arden' },
    updatedAt: '2026-06-26T22:18:00.000Z',
    labels: ['design', 'good first issue'],
    summary: 'The first-run screen needs a concise state before GitHub OAuth is wired in.'
  },
  {
    id: 'action-1',
    kind: 'action',
    title: 'Renderer build failed on macOS',
    repository: 'oh-my-github/client',
    state: 'failed',
    author: { login: 'github-actions' },
    updatedAt: '2026-06-26T18:03:00.000Z',
    labels: ['ci', 'renderer'],
    summary: 'The app shell build failed during renderer type checking.'
  }
]

const organizations: GitHubOrganization[] = [
  {
    id: 1,
    login: 'oh-my-github',
    avatarUrl: 'https://avatars.githubusercontent.com/u/9919?s=80&v=4',
    description: 'Desktop GitHub workspace'
  },
  {
    id: 2,
    login: 'electron',
    avatarUrl: 'https://avatars.githubusercontent.com/u/13409222?s=80&v=4',
    description: 'Build cross-platform desktop apps'
  },
  {
    id: 3,
    login: 'vuejs',
    avatarUrl: 'https://avatars.githubusercontent.com/u/6128107?s=80&v=4',
    description: 'The progressive JavaScript framework'
  },
  {
    id: 4,
    login: 'github',
    avatarUrl: 'https://avatars.githubusercontent.com/u/9919?s=80&v=4',
    description: 'GitHub'
  },
  {
    id: 5,
    login: 'octokit',
    avatarUrl: 'https://avatars.githubusercontent.com/u/3430433?s=80&v=4',
    description: 'GitHub API clients'
  }
]

const repositoriesByOrganization: Record<string, GitHubRepository[]> = {
  'oh-my-github': createMockRepositories('oh-my-github', [
    'client',
    'api',
    'ui',
    'desktop-shell',
    'workspace',
    'notifications',
    'reviews',
    'actions',
    'settings',
    'design-system',
    'oauth',
    'release',
  ]),
  electron: createMockRepositories('electron', ['electron', 'forge', 'fiddle']),
  vuejs: createMockRepositories('vuejs', ['core', 'router', 'pinia', 'vitepress']),
  github: createMockRepositories('github', ['docs', 'hub', 'training-kit']),
  octokit: createMockRepositories('octokit', ['octokit.js', 'rest.js', 'graphql.js']),
}

const pullRequestsByRepository: Record<string, GitHubPullRequest[]> = {
  'oh-my-github/client': createMockPullRequests('oh-my-github', 'client', ['Wire workspace sidebar states', 'Polish Electron titlebar', 'Draft issue detail routes']),
  'oh-my-github/api': createMockPullRequests('oh-my-github', 'api', ['Add typed GitHub modules', 'Normalize notification updates']),
  'vuejs/core': createMockPullRequests('vuejs', 'core', ['Improve scheduler traces', 'Draft compiler warning copy']),
}

const issuesByRepository: Record<string, GitHubIssue[]> = {
  'oh-my-github/client': createMockIssues('oh-my-github', 'client', ['Sidebar active item is too tall', 'Bookmark menu needs keyboard polish']),
  'oh-my-github/ui': createMockIssues('oh-my-github', 'ui', ['Document compact menu sizing']),
  'vuejs/core': createMockIssues('vuejs', 'core', ['Regression in suspense hydration']),
}

export class MockGitHubClient implements GitHubClient {
  async listViewerOrganizations(): Promise<GitHubOrganization[]> {
    return organizations
  }

  async listOrganizationRepositories(owner: string): Promise<GitHubRepository[]> {
    return repositoriesByOrganization[owner] ?? []
  }

  async listViewerPullRequests(): Promise<GitHubPullRequest[]> {
    return Object.values(pullRequestsByRepository).flat().slice(0, 8)
  }

  async listPullRequestCategory(options: ListPullRequestCategoryOptions): Promise<GitHubPullRequest[]> {
    const pullRequests = Object.values(pullRequestsByRepository).flat()

    if (options.category === 'created-by-me') {
      return pullRequests.filter((pullRequest) => pullRequest.author.login === 'acbox')
    }

    if (options.category === 'needs-review') {
      return pullRequests.filter((pullRequest) => pullRequest.state !== 'draft')
    }

    if (options.category === 'inbox') {
      return pullRequests.filter((pullRequest) => pullRequest.hasUpdates)
    }

    return pullRequests.filter((pullRequest) => pullRequest.labels.includes('review'))
  }

  async listRepositoryPullRequests(options: ListRepositoryWorkspaceItemsOptions): Promise<GitHubPullRequest[]> {
    return pullRequestsByRepository[`${options.owner}/${options.repo}`] ?? []
  }

  async listViewerIssues(): Promise<GitHubIssue[]> {
    return Object.values(issuesByRepository).flat().slice(0, 8)
  }

  async listIssueCategory(options: ListIssueCategoryOptions): Promise<GitHubIssue[]> {
    const issues = Object.values(issuesByRepository).flat()

    if (options.category === 'created-by-me') {
      return issues.filter((issue) => issue.author.login === 'acbox')
    }

    if (options.category === 'inbox') {
      return issues.filter((issue) => issue.hasUpdates)
    }

    return issues.filter((issue) => issue.labels.includes('triage'))
  }

  async listRepositoryIssues(options: ListRepositoryWorkspaceItemsOptions): Promise<GitHubIssue[]> {
    return issuesByRepository[`${options.owner}/${options.repo}`] ?? []
  }

  async listNotifications(): Promise<GitHubWorkspaceItem[]> {
    return items
  }

  async listPullRequests(): Promise<GitHubWorkspaceItem[]> {
    return items.filter((item) => item.kind === 'pull_request')
  }

  async listIssues(): Promise<GitHubWorkspaceItem[]> {
    return items.filter((item) => item.kind === 'issue')
  }
}

function createMockRepositories(owner: string, names: string[]): GitHubRepository[] {
  return names.map((name, index) => ({
    id: Number(`${organizations.find((organization) => organization.login === owner)?.id ?? 9}${index + 1}`),
    name,
    nameWithOwner: `${owner}/${name}`,
    owner,
    description: `${name} workspace placeholder`,
    isPrivate: index % 5 === 0,
    updatedAt: new Date(Date.UTC(2026, 5, 27 - index)).toISOString(),
    url: `https://github.com/${owner}/${name}`,
  }))
}

function createMockPullRequests(owner: string, repo: string, titles: string[]): GitHubPullRequest[] {
  return titles.map((title, index) => ({
    id: `mock-pr:${owner}/${repo}:${index + 1}`,
    owner,
    repo,
    repository: `${owner}/${repo}`,
    number: index + 11,
    title,
    state: index === 2 ? 'draft' : index === 1 ? 'cannot_merge' : 'open',
    ciState: index === 0 ? 'success' : index === 1 ? 'failure' : 'pending',
    author: { login: index % 2 === 0 ? 'acbox' : 'octo-lina' },
    updatedAt: new Date(Date.UTC(2026, 5, 27 - index, 8)).toISOString(),
    labels: index === 0 ? ['workspace'] : ['review'],
    url: `https://github.com/${owner}/${repo}/pull/${index + 11}`,
    hasUpdates: index === 0,
  }))
}

function createMockIssues(owner: string, repo: string, titles: string[]): GitHubIssue[] {
  return titles.map((title, index) => ({
    id: `mock-issue:${owner}/${repo}:${index + 1}`,
    owner,
    repo,
    repository: `${owner}/${repo}`,
    number: index + 31,
    title,
    state: 'open',
    author: { login: index % 2 === 0 ? 'acbox' : 'arden' },
    updatedAt: new Date(Date.UTC(2026, 5, 26 - index, 10)).toISOString(),
    labels: index === 0 ? ['bug'] : ['triage'],
    url: `https://github.com/${owner}/${repo}/issues/${index + 31}`,
    hasUpdates: index === 1,
  }))
}
