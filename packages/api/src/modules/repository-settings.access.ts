import type { GitHubOctokit } from '../transport'
import type {
  GitHubInteractionLimitExpiry,
  GitHubInteractionLimitGroup,
  GitHubInteractionLimits,
  GitHubRepositoryAccessOverview,
  GitHubRepositoryCollaborator,
  GitHubRepositoryCollaboratorRole,
  GitHubRepositoryInvitation,
  GitHubRepositoryTeamAccess,
  RepositoryOptions,
} from '../types'

interface CollaboratorResponse {
  login?: string | null
  avatar_url?: string | null
  role_name?: string | null
  html_url?: string | null
}

interface InvitationResponse {
  id?: number
  invitee?: { login?: string | null; avatar_url?: string | null } | null
  permissions?: string | null
  created_at?: string | null
  html_url?: string | null
}

interface TeamResponse {
  slug?: string | null
  name?: string | null
  permission?: string | null
}

interface InteractionLimitsResponse {
  limit?: string | null
  origin?: string | null
  expires_at?: string | null
}

export interface RepositoryTeamOptions extends RepositoryOptions {
  org: string
  teamSlug: string
}

export class RepositorySettingsAccessApi {
  constructor(private readonly octokit: GitHubOctokit) {}

  async getAccessOverview(options: RepositoryOptions): Promise<GitHubRepositoryAccessOverview> {
    const [ownerType, collaborators, invitations, teams] = await Promise.all([
      this.getOwnerType(options.owner),
      this.getCollaborators(options),
      this.getInvitations(options),
      this.getTeams(options),
    ])

    return { ownerType, collaborators, invitations, teams }
  }

  async addCollaborator(
    options: RepositoryOptions & { username: string; permission: GitHubRepositoryCollaboratorRole },
  ): Promise<'invited' | 'added'> {
    const response = await this.octokit.request('PUT /repos/{owner}/{repo}/collaborators/{username}', {
      owner: options.owner,
      repo: options.repo,
      username: options.username,
      permission: options.permission,
    })

    return response.status === 201 ? 'invited' : 'added'
  }

  async removeCollaborator(options: RepositoryOptions & { username: string }): Promise<void> {
    await this.octokit.request('DELETE /repos/{owner}/{repo}/collaborators/{username}', {
      owner: options.owner,
      repo: options.repo,
      username: options.username,
    })
  }

  async updateInvitation(
    options: RepositoryOptions & { invitationId: number; permissions: string },
  ): Promise<void> {
    await this.octokit.request('PATCH /repos/{owner}/{repo}/invitations/{invitation_id}', {
      owner: options.owner,
      repo: options.repo,
      invitation_id: options.invitationId,
      permissions: options.permissions as 'read' | 'write' | 'maintain' | 'triage' | 'admin',
    })
  }

  async cancelInvitation(options: RepositoryOptions & { invitationId: number }): Promise<void> {
    await this.octokit.request('DELETE /repos/{owner}/{repo}/invitations/{invitation_id}', {
      owner: options.owner,
      repo: options.repo,
      invitation_id: options.invitationId,
    })
  }

  async addOrUpdateTeam(options: RepositoryTeamOptions & { permission: string }): Promise<void> {
    await this.octokit.request('PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}', {
      org: options.org,
      team_slug: options.teamSlug,
      owner: options.owner,
      repo: options.repo,
      permission: options.permission,
    })
  }

  async removeTeam(options: RepositoryTeamOptions): Promise<void> {
    await this.octokit.request('DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}', {
      org: options.org,
      team_slug: options.teamSlug,
      owner: options.owner,
      repo: options.repo,
    })
  }

  async getInteractionLimits(options: RepositoryOptions): Promise<GitHubInteractionLimits | null> {
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/interaction-limits', {
      owner: options.owner,
      repo: options.repo,
    })
    const data = response.data as InteractionLimitsResponse

    if (!data?.limit) return null

    return {
      limit: data.limit as GitHubInteractionLimitGroup,
      origin: data.origin ?? null,
      expiresAt: data.expires_at ?? null,
    }
  }

  async setInteractionLimits(
    options: RepositoryOptions & { limit: GitHubInteractionLimitGroup; expiry?: GitHubInteractionLimitExpiry },
  ): Promise<void> {
    await this.octokit.request('PUT /repos/{owner}/{repo}/interaction-limits', {
      owner: options.owner,
      repo: options.repo,
      limit: options.limit,
      ...(options.expiry ? { expiry: options.expiry } : {}),
    })
  }

  async clearInteractionLimits(options: RepositoryOptions): Promise<void> {
    await this.octokit.request('DELETE /repos/{owner}/{repo}/interaction-limits', {
      owner: options.owner,
      repo: options.repo,
    })
  }

  private async getOwnerType(owner: string): Promise<'User' | 'Organization'> {
    try {
      const response = await this.octokit.request('GET /users/{username}', { username: owner })
      const type = (response.data as { type?: string | null }).type
      return type === 'Organization' ? 'Organization' : 'User'
    } catch {
      return 'User'
    }
  }

  private async getCollaborators(options: RepositoryOptions): Promise<GitHubRepositoryCollaborator[]> {
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/collaborators', {
      owner: options.owner,
      repo: options.repo,
      affiliation: 'direct',
      per_page: 100,
    })

    return ((response.data ?? []) as CollaboratorResponse[]).map((item) => ({
      login: item.login ?? '',
      avatarUrl: item.avatar_url ?? '',
      roleName: item.role_name ?? 'pull',
      htmlUrl: item.html_url ?? `https://github.com/${item.login ?? ''}`,
    }))
  }

  private async getInvitations(options: RepositoryOptions): Promise<GitHubRepositoryInvitation[]> {
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/invitations', {
      owner: options.owner,
      repo: options.repo,
      per_page: 100,
    })

    return ((response.data ?? []) as InvitationResponse[]).map((item) => ({
      id: item.id ?? 0,
      inviteeLogin: item.invitee?.login ?? null,
      inviteeAvatarUrl: item.invitee?.avatar_url ?? null,
      permissions: item.permissions ?? 'read',
      createdAt: item.created_at ?? null,
      htmlUrl: item.html_url ?? '',
    }))
  }

  private async getTeams(options: RepositoryOptions): Promise<GitHubRepositoryTeamAccess[]> {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/teams', {
        owner: options.owner,
        repo: options.repo,
        per_page: 100,
      })

      return ((response.data ?? []) as TeamResponse[]).map((item) => ({
        slug: item.slug ?? '',
        name: item.name ?? item.slug ?? '',
        permission: item.permission ?? 'pull',
        org: options.owner,
      }))
    } catch {
      return []
    }
  }
}
