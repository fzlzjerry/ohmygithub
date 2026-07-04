import { describe, expect, it, vi } from 'vitest'
import type { GitHubOctokit } from '../transport'
import { RepositorySettingsAccessApi } from './repository-settings.access'

describe('RepositorySettingsAccessApi', () => {
  it('maps the access overview from collaborators, invitations, and teams', async () => {
    const { api, request } = createApi()

    const overview = await api.getAccessOverview({ owner: 'octo-org', repo: 'hello-world' })

    expect(request).toHaveBeenCalledWith('GET /repos/{owner}/{repo}/collaborators', {
      owner: 'octo-org',
      repo: 'hello-world',
      affiliation: 'direct',
      per_page: 100,
    })
    expect(overview.ownerType).toBe('Organization')
    expect(overview.collaborators).toEqual([
      {
        login: 'alice',
        avatarUrl: 'https://avatars.example/alice',
        roleName: 'admin',
        htmlUrl: 'https://github.com/alice',
      },
    ])
    expect(overview.invitations).toEqual([
      {
        id: 7,
        inviteeLogin: 'bob',
        inviteeAvatarUrl: 'https://avatars.example/bob',
        permissions: 'write',
        createdAt: '2026-07-01T00:00:00Z',
        htmlUrl: 'https://github.com/octo-org/hello-world/invitations',
      },
    ])
    expect(overview.teams).toEqual([
      { slug: 'core', name: 'Core', permission: 'push', org: 'octo-org' },
    ])
  })

  it('tolerates a failing teams request for user-owned repositories', async () => {
    const { api } = createApi({ teamsError: true, ownerType: 'User' })

    const overview = await api.getAccessOverview({ owner: 'acbox', repo: 'hello-world' })

    expect(overview.ownerType).toBe('User')
    expect(overview.teams).toEqual([])
  })

  it('distinguishes invited from added collaborators', async () => {
    const { api, request } = createApi()

    const invited = await api.addCollaborator({
      owner: 'octo-org',
      repo: 'hello-world',
      username: 'carol',
      permission: 'push',
    })

    expect(request).toHaveBeenCalledWith('PUT /repos/{owner}/{repo}/collaborators/{username}', {
      owner: 'octo-org',
      repo: 'hello-world',
      username: 'carol',
      permission: 'push',
    })
    expect(invited).toBe('invited')

    const added = await api.addCollaborator({
      owner: 'octo-org',
      repo: 'hello-world',
      username: 'dave',
      permission: 'pull',
    })
    expect(added).toBe('added')
  })

  it('manages invitations, teams, and collaborator removal', async () => {
    const { api, request } = createApi()

    await api.updateInvitation({ owner: 'o', repo: 'r', invitationId: 7, permissions: 'read' })
    expect(request).toHaveBeenCalledWith('PATCH /repos/{owner}/{repo}/invitations/{invitation_id}', {
      owner: 'o',
      repo: 'r',
      invitation_id: 7,
      permissions: 'read',
    })

    await api.cancelInvitation({ owner: 'o', repo: 'r', invitationId: 7 })
    expect(request).toHaveBeenCalledWith('DELETE /repos/{owner}/{repo}/invitations/{invitation_id}', {
      owner: 'o',
      repo: 'r',
      invitation_id: 7,
    })

    await api.removeCollaborator({ owner: 'o', repo: 'r', username: 'alice' })
    expect(request).toHaveBeenCalledWith('DELETE /repos/{owner}/{repo}/collaborators/{username}', {
      owner: 'o',
      repo: 'r',
      username: 'alice',
    })

    await api.addOrUpdateTeam({ org: 'octo-org', teamSlug: 'core', owner: 'o', repo: 'r', permission: 'maintain' })
    expect(request).toHaveBeenCalledWith('PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}', {
      org: 'octo-org',
      team_slug: 'core',
      owner: 'o',
      repo: 'r',
      permission: 'maintain',
    })

    await api.removeTeam({ org: 'octo-org', teamSlug: 'core', owner: 'o', repo: 'r' })
    expect(request).toHaveBeenCalledWith('DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}', {
      org: 'octo-org',
      team_slug: 'core',
      owner: 'o',
      repo: 'r',
    })
  })

  it('reads, sets, and clears repository interaction limits', async () => {
    const { api, request } = createApi()

    const limits = await api.getInteractionLimits({ owner: 'o', repo: 'r' })
    expect(limits).toEqual({
      limit: 'contributors_only',
      origin: 'repository',
      expiresAt: '2026-07-08T00:00:00Z',
    })

    await api.setInteractionLimits({ owner: 'o', repo: 'r', limit: 'existing_users', expiry: 'one_week' })
    expect(request).toHaveBeenCalledWith('PUT /repos/{owner}/{repo}/interaction-limits', {
      owner: 'o',
      repo: 'r',
      limit: 'existing_users',
      expiry: 'one_week',
    })

    await api.clearInteractionLimits({ owner: 'o', repo: 'r' })
    expect(request).toHaveBeenCalledWith('DELETE /repos/{owner}/{repo}/interaction-limits', {
      owner: 'o',
      repo: 'r',
    })
  })

  it('returns null interaction limits when none are active', async () => {
    const { api } = createApi({ emptyLimits: true })

    const limits = await api.getInteractionLimits({ owner: 'o', repo: 'r' })

    expect(limits).toBeNull()
  })
})

function createApi(overrides: { teamsError?: boolean; ownerType?: string; emptyLimits?: boolean } = {}) {
  let putCollaboratorCalls = 0
  const request = vi.fn(async (route: string) => {
    if (route === 'GET /users/{username}') {
      return { data: { type: overrides.ownerType ?? 'Organization' } }
    }
    if (route === 'GET /repos/{owner}/{repo}/collaborators') {
      return {
        data: [
          {
            login: 'alice',
            avatar_url: 'https://avatars.example/alice',
            role_name: 'admin',
            html_url: 'https://github.com/alice',
          },
        ],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/invitations') {
      return {
        data: [
          {
            id: 7,
            invitee: { login: 'bob', avatar_url: 'https://avatars.example/bob' },
            permissions: 'write',
            created_at: '2026-07-01T00:00:00Z',
            html_url: 'https://github.com/octo-org/hello-world/invitations',
          },
        ],
      }
    }
    if (route === 'GET /repos/{owner}/{repo}/teams') {
      if (overrides.teamsError) throw new Error('not applicable')
      return { data: [{ slug: 'core', name: 'Core', permission: 'push' }] }
    }
    if (route === 'PUT /repos/{owner}/{repo}/collaborators/{username}') {
      putCollaboratorCalls += 1
      return putCollaboratorCalls === 1
        ? { status: 201, data: { id: 7 } }
        : { status: 204, data: undefined }
    }
    if (route === 'GET /repos/{owner}/{repo}/interaction-limits') {
      if (overrides.emptyLimits) return { data: {} }
      return {
        data: {
          limit: 'contributors_only',
          origin: 'repository',
          expires_at: '2026-07-08T00:00:00Z',
        },
      }
    }
    return { data: {}, status: 204 }
  })
  const octokit = { request } as unknown as GitHubOctokit

  return { api: new RepositorySettingsAccessApi(octokit), request }
}
