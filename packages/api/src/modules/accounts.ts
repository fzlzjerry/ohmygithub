import type { GitHubOctokit } from '../transport'
import type { GitHubAccountProfile, GitHubOrganization, GitHubRepository } from '../types'

interface UserProfileResponse {
  id?: number
  login?: string
  name?: string | null
  avatar_url?: string | null
  bio?: string | null
  company?: string | null
  location?: string | null
  blog?: string | null
  html_url?: string | null
  followers?: number
  following?: number
  public_repos?: number
  type?: string | null
}

export class AccountsApi {
  constructor(private readonly octokit: GitHubOctokit) {}

  async getProfile(login: string): Promise<GitHubAccountProfile> {
    const response = await this.octokit.request('GET /users/{username}', {
      username: login,
    })
    const user = response.data as UserProfileResponse
    const normalizedLogin = user.login?.trim() || login

    return {
      id: user.id ?? 0,
      login: normalizedLogin,
      name: user.name ?? null,
      avatarUrl: user.avatar_url ?? `https://github.com/${encodeURIComponent(normalizedLogin)}.png?size=96`,
      bio: user.bio ?? null,
      company: user.company ?? null,
      location: user.location ?? null,
      blog: user.blog ?? null,
      url: user.html_url ?? `https://github.com/${encodeURIComponent(normalizedLogin)}`,
      followers: user.followers ?? 0,
      following: user.following ?? 0,
      publicRepos: user.public_repos ?? 0,
      type: user.type ?? 'User',
    }
  }

  async listViewerOrganizations(): Promise<GitHubOrganization[]> {
    const organizations = await this.octokit.paginate(
      this.octokit.rest.orgs.listForAuthenticatedUser,
      {
        per_page: 100
      }
    )

    return organizations.map((organization) => ({
      id: organization.id,
      login: organization.login,
      avatarUrl: organization.avatar_url ?? '',
      description: organization.description ?? null
    }))
  }

  async listOrganizationRepositories(owner: string): Promise<GitHubRepository[]> {
    const repositories = await this.octokit.paginate(
      this.octokit.rest.repos.listForOrg,
      {
        org: owner,
        type: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100
      }
    )

    return repositories.map((repository) => {
      const repositoryOwner = repository.owner?.login ?? owner

      return {
        id: repository.id,
        name: repository.name,
        nameWithOwner: repository.full_name ?? `${repositoryOwner}/${repository.name}`,
        owner: repositoryOwner,
        description: repository.description ?? null,
        isPrivate: repository.private,
        updatedAt: repository.updated_at ?? '',
        url: repository.html_url ?? ''
      }
    })
  }
}
