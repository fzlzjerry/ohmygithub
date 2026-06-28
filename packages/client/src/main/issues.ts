import { createGitHubApi, type GitHubIssueCategory } from '@oh-my-github/api'
import { ipcMain } from 'electron'
import { getAuthenticatedAccessToken } from './auth'
import { resolveGitHubProxyUrl } from './proxy'

export function registerIssuesIpc(): void {
  ipcMain.handle('issues:list-category', (_event, category: GitHubIssueCategory) =>
    listIssueCategory(category)
  )
  ipcMain.handle('issues:list-viewer', () => listViewerIssues())
  ipcMain.handle('issues:list-repository', (_event, owner: string, repo: string) =>
    listRepositoryIssues(owner, repo)
  )
}

async function listIssueCategory(category: GitHubIssueCategory) {
  if (!isIssueCategory(category)) {
    throw new Error('Unknown issue category')
  }

  const api = await createAuthenticatedGitHubApi()

  return api.issues.listIssueCategory({ category })
}

async function listViewerIssues() {
  const api = await createAuthenticatedGitHubApi()

  return api.issues.listViewerIssues()
}

function isIssueCategory(value: string): value is GitHubIssueCategory {
  return value === 'created-by-me'
    || value === 'inbox'
    || value === 'mentioned-me'
}

async function listRepositoryIssues(owner: string, repo: string) {
  const normalizedOwner = owner.trim()
  const normalizedRepo = repo.trim()

  if (!normalizedOwner || !normalizedRepo) {
    throw new Error('Repository owner and name are required')
  }

  const api = await createAuthenticatedGitHubApi()

  return api.issues.listRepositoryIssues({
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
