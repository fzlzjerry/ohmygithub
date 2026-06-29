import { createGitHubApi } from '@oh-my-github/api'
import { ipcMain } from 'electron'
import { getAuthenticatedAccessToken } from './auth'
import { resolveGitHubProxyUrl } from './proxy'

export function registerAccountsIpc(): void {
  ipcMain.handle('accounts:get-profile', (_event, login: string) => getAccountProfile(login))
  ipcMain.handle('accounts:list-organizations', () => listViewerOrganizations())
  ipcMain.handle('accounts:list-organization-repositories', (_event, owner: string) =>
    listOrganizationRepositories(owner)
  )
}

async function getAccountProfile(login: string) {
  const normalizedLogin = String(login ?? '').trim()

  if (!normalizedLogin) {
    throw new Error('Account login is required')
  }

  const api = await createAuthenticatedGitHubApi()

  return api.accounts.getProfile(normalizedLogin)
}

async function listViewerOrganizations() {
  const api = await createAuthenticatedGitHubApi()

  return api.accounts.listViewerOrganizations()
}

async function listOrganizationRepositories(owner: string) {
  const normalizedOwner = owner.trim()

  if (!normalizedOwner) {
    throw new Error('Organization owner is required')
  }

  const api = await createAuthenticatedGitHubApi()

  return api.accounts.listOrganizationRepositories(normalizedOwner)
}

async function createAuthenticatedGitHubApi() {
  return createGitHubApi({
    token: getAuthenticatedAccessToken(),
    proxyUrl: await resolveGitHubProxyUrl()
  })
}
