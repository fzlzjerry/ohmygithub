import {
  createGitHubApi,
  type GitHubInteractionLimitExpiry,
  type GitHubInteractionLimitGroup,
  type GitHubRepositoryCollaboratorRole,
  type UpdateRepositoryGeneralSettingsInput,
} from '@oh-my-github/api'
import { ipcMain } from 'electron'
import { getAuthenticatedAccessToken } from './auth'
import { resolveGitHubProxyUrl } from './proxy'

export function registerRepositorySettingsIpc(): void {
  ipcMain.handle('repository-settings:get-general', async (_event, owner: string, repo: string) =>
    (await createAuthenticatedGitHubApi()).repositorySettings.getGeneralSettings(normalizeRepository(owner, repo))
  )
  ipcMain.handle(
    'repository-settings:update-general',
    async (_event, owner: string, repo: string, input: UpdateRepositoryGeneralSettingsInput) =>
      (await createAuthenticatedGitHubApi()).repositorySettings.updateGeneralSettings({
        ...normalizeRepository(owner, repo),
        input,
      })
  )
  ipcMain.handle('repository-settings:replace-topics', async (_event, owner: string, repo: string, names: string[]) =>
    (await createAuthenticatedGitHubApi()).repositorySettings.replaceTopics({
      ...normalizeRepository(owner, repo),
      names: Array.isArray(names) ? names.map((name) => String(name).trim()).filter(Boolean) : [],
    })
  )
  ipcMain.handle('repository-settings:set-discussions', async (_event, repositoryNodeId: string, enabled: boolean) =>
    (await createAuthenticatedGitHubApi()).repositorySettings.setDiscussionsEnabled({
      repositoryNodeId: String(repositoryNodeId),
      enabled: Boolean(enabled),
    })
  )
  ipcMain.handle('repository-settings:set-sponsorships', async (_event, repositoryNodeId: string, enabled: boolean) =>
    (await createAuthenticatedGitHubApi()).repositorySettings.setSponsorshipsEnabled({
      repositoryNodeId: String(repositoryNodeId),
      enabled: Boolean(enabled),
    })
  )
  ipcMain.handle(
    'repository-settings:set-immutable-releases',
    async (_event, owner: string, repo: string, enabled: boolean) =>
      (await createAuthenticatedGitHubApi()).repositorySettings.setImmutableReleases({
        ...normalizeRepository(owner, repo),
        enabled: Boolean(enabled),
      })
  )
  ipcMain.handle(
    'repository-settings:transfer',
    async (_event, owner: string, repo: string, newOwner: string, newName?: string) =>
      (await createAuthenticatedGitHubApi()).repositorySettings.transferRepository({
        ...normalizeRepository(owner, repo),
        newOwner: String(newOwner ?? '').trim(),
        newName: newName ? String(newName).trim() : undefined,
      })
  )
  ipcMain.handle('repository-settings:delete', async (_event, owner: string, repo: string) =>
    (await createAuthenticatedGitHubApi()).repositorySettings.deleteRepository(normalizeRepository(owner, repo))
  )

  ipcMain.handle('repository-settings:access-overview', async (_event, owner: string, repo: string) =>
    (await createAuthenticatedGitHubApi()).repositorySettingsAccess.getAccessOverview(normalizeRepository(owner, repo))
  )
  ipcMain.handle(
    'repository-settings:access-add-collaborator',
    async (_event, owner: string, repo: string, username: string, permission: GitHubRepositoryCollaboratorRole) =>
      (await createAuthenticatedGitHubApi()).repositorySettingsAccess.addCollaborator({
        ...normalizeRepository(owner, repo),
        username: String(username ?? '').trim(),
        permission,
      })
  )
  ipcMain.handle(
    'repository-settings:access-remove-collaborator',
    async (_event, owner: string, repo: string, username: string) =>
      (await createAuthenticatedGitHubApi()).repositorySettingsAccess.removeCollaborator({
        ...normalizeRepository(owner, repo),
        username: String(username ?? '').trim(),
      })
  )
  ipcMain.handle(
    'repository-settings:access-update-invitation',
    async (_event, owner: string, repo: string, invitationId: number, permissions: string) =>
      (await createAuthenticatedGitHubApi()).repositorySettingsAccess.updateInvitation({
        ...normalizeRepository(owner, repo),
        invitationId: Number(invitationId),
        permissions: String(permissions ?? ''),
      })
  )
  ipcMain.handle(
    'repository-settings:access-cancel-invitation',
    async (_event, owner: string, repo: string, invitationId: number) =>
      (await createAuthenticatedGitHubApi()).repositorySettingsAccess.cancelInvitation({
        ...normalizeRepository(owner, repo),
        invitationId: Number(invitationId),
      })
  )
  ipcMain.handle(
    'repository-settings:access-set-team',
    async (_event, org: string, teamSlug: string, owner: string, repo: string, permission: string) =>
      (await createAuthenticatedGitHubApi()).repositorySettingsAccess.addOrUpdateTeam({
        ...normalizeRepository(owner, repo),
        org: String(org ?? '').trim(),
        teamSlug: String(teamSlug ?? '').trim(),
        permission: String(permission ?? 'pull'),
      })
  )
  ipcMain.handle(
    'repository-settings:access-remove-team',
    async (_event, org: string, teamSlug: string, owner: string, repo: string) =>
      (await createAuthenticatedGitHubApi()).repositorySettingsAccess.removeTeam({
        ...normalizeRepository(owner, repo),
        org: String(org ?? '').trim(),
        teamSlug: String(teamSlug ?? '').trim(),
      })
  )
  ipcMain.handle('repository-settings:access-interaction-limits', async (_event, owner: string, repo: string) =>
    (await createAuthenticatedGitHubApi()).repositorySettingsAccess.getInteractionLimits(normalizeRepository(owner, repo))
  )
  ipcMain.handle(
    'repository-settings:access-set-interaction-limits',
    async (
      _event,
      owner: string,
      repo: string,
      limit: GitHubInteractionLimitGroup,
      expiry?: GitHubInteractionLimitExpiry,
    ) =>
      (await createAuthenticatedGitHubApi()).repositorySettingsAccess.setInteractionLimits({
        ...normalizeRepository(owner, repo),
        limit,
        expiry,
      })
  )
  ipcMain.handle(
    'repository-settings:access-clear-interaction-limits',
    async (_event, owner: string, repo: string) =>
      (await createAuthenticatedGitHubApi()).repositorySettingsAccess.clearInteractionLimits(
        normalizeRepository(owner, repo),
      )
  )
}

async function createAuthenticatedGitHubApi() {
  return createGitHubApi({
    token: getAuthenticatedAccessToken(),
    proxyUrl: await resolveGitHubProxyUrl()
  })
}

function normalizeRepository(owner: string, repo: string) {
  const normalizedOwner = String(owner ?? '').trim()
  const normalizedRepo = String(repo ?? '').trim()

  if (!normalizedOwner || !normalizedRepo) {
    throw new Error('Repository owner and name are required')
  }

  return {
    owner: normalizedOwner,
    repo: normalizedRepo,
  }
}
