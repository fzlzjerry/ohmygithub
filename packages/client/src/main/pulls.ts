import { createGitHubApi, type GitHubPullRequestCategory } from '@oh-my-github/api'
import { ipcMain } from 'electron'
import { getAuthenticatedAccessToken } from './auth'
import { resolveGitHubProxyUrl } from './proxy'

export function registerPullsIpc(): void {
  ipcMain.handle('pulls:list-category', (_event, category: GitHubPullRequestCategory) =>
    listPullRequestCategory(category)
  )
  ipcMain.handle('pulls:list-viewer', () => listViewerPullRequests())
  ipcMain.handle('pulls:list-repository', (_event, owner: string, repo: string) =>
    listRepositoryPullRequests(owner, repo)
  )
}

async function listPullRequestCategory(category: GitHubPullRequestCategory) {
  if (!isPullRequestCategory(category)) {
    throw new Error('Unknown pull request category')
  }

  const api = await createAuthenticatedGitHubApi()

  return api.pulls.listPullRequestCategory({ category })
}

async function listViewerPullRequests() {
  const api = await createAuthenticatedGitHubApi()

  return api.pulls.listViewerPullRequests()
}

function isPullRequestCategory(value: string): value is GitHubPullRequestCategory {
  return value === 'created-by-me'
    || value === 'needs-review'
    || value === 'inbox'
    || value === 'mentioned-me'
}

async function listRepositoryPullRequests(owner: string, repo: string) {
  const normalizedOwner = owner.trim()
  const normalizedRepo = repo.trim()

  if (!normalizedOwner || !normalizedRepo) {
    throw new Error('Repository owner and name are required')
  }

  const api = await createAuthenticatedGitHubApi()

  return api.pulls.listRepositoryPullRequests({
    owner: normalizedOwner,
    repo: normalizedRepo
  })
}

async function createAuthenticatedGitHubApi() {
  return createGitHubApi({
    token: getAuthenticatedAccessToken(),
    proxyUrl: await resolveGitHubProxyUrl()
  })
}
