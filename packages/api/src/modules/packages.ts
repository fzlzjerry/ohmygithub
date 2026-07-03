import type { GitHubOctokit } from '../transport'
import type {
  GitHubPackage,
  GitHubPackagePage,
  GitHubPackageType,
  GitHubPackageVersion,
  GitHubPackageVersionPage,
  GitHubPackageVisibility,
  ListPackageVersionsOptions,
  ListRepositoryPackagesOptions,
  PackageTargetOptions,
  PackageVersionTargetOptions,
} from '../types'

const PACKAGE_TYPES: GitHubPackageType[] = ['npm', 'maven', 'rubygems', 'docker', 'nuget', 'container']

const DEFAULT_PER_PAGE = 20
const VERSION_DEFAULT_PER_PAGE = 30
const MAX_PER_PAGE = 100
const OWNER_PAGE_SIZE = 100
const MAX_OWNER_PAGES = 3

type OwnerScope = 'orgs' | 'users'

interface RepositoryRefResponse {
  name?: string | null
  owner?: { login?: string | null } | null
}

interface PackageResponse {
  id?: number
  name?: string | null
  package_type?: string | null
  visibility?: string | null
  version_count?: number | null
  owner?: { login?: string | null } | null
  repository?: RepositoryRefResponse | null
  html_url?: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface PackageVersionResponse {
  id?: number
  name?: string | null
  html_url?: string | null
  description?: string | null
  metadata?: { container?: { tags?: string[] | null } | null } | null
  created_at?: string | null
  updated_at?: string | null
}

interface OwnerPackagesFetchResult {
  items: PackageResponse[]
  truncated: boolean
}

type OwnerPackagesOutcome =
  | { packageType: GitHubPackageType; ok: true; items: PackageResponse[]; truncated: boolean }
  | { packageType: GitHubPackageType; ok: false; error: unknown }

export class PackagesApi {
  constructor(private readonly octokit: GitHubOctokit) {}

  async listRepositoryPackages(options: ListRepositoryPackagesOptions): Promise<GitHubPackagePage> {
    const page = normalizePositiveInteger(options.page, 1)
    const perPage = normalizePerPage(options.perPage, DEFAULT_PER_PAGE)
    const scope = await this.resolveOwnerScope(options.owner)

    const outcomes: OwnerPackagesOutcome[] = await Promise.all(
      PACKAGE_TYPES.map(async (packageType): Promise<OwnerPackagesOutcome> => {
        try {
          const result = await this.fetchAllOwnerPackages(scope, options.owner, packageType)
          return { packageType, ok: true, ...result }
        } catch (error) {
          return { packageType, ok: false, error }
        }
      }),
    )

    const failedTypes = outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.packageType)

    if (failedTypes.length === PACKAGE_TYPES.length) {
      const lastFailure = outcomes[outcomes.length - 1]
      throw lastFailure.ok ? new Error('Failed to list repository packages') : lastFailure.error
    }

    const truncated = outcomes.some((outcome) => outcome.ok && outcome.truncated)
    const targetOwner = options.owner.toLowerCase()
    const targetRepo = options.repo.toLowerCase()

    const filtered = outcomes
      .flatMap((outcome) => (outcome.ok ? outcome.items : []))
      .filter((pkg) => matchesRepository(pkg.repository, targetOwner, targetRepo))
      .map((pkg) => mapPackage(pkg))
      .sort((a, b) => compareUpdatedAtDescending(a.updatedAt, b.updatedAt))

    const totalCount = filtered.length
    const offset = (page - 1) * perPage

    return {
      items: filtered.slice(offset, offset + perPage),
      totalCount,
      page,
      perPage,
      hasNextPage: page * perPage < totalCount,
      failedTypes,
      truncated,
    }
  }

  async listPackageVersions(options: ListPackageVersionsOptions): Promise<GitHubPackageVersionPage> {
    const page = normalizePositiveInteger(options.page, 1)
    const perPage = normalizePerPage(options.perPage, VERSION_DEFAULT_PER_PAGE)
    const scope = await this.resolveOwnerScope(options.owner)

    const response = scope === 'orgs'
      ? await this.octokit.request('GET /orgs/{org}/packages/{package_type}/{package_name}/versions', {
        org: options.owner,
        package_type: options.packageType,
        package_name: options.packageName,
        page,
        per_page: perPage,
      })
      : await this.octokit.request('GET /users/{username}/packages/{package_type}/{package_name}/versions', {
        username: options.owner,
        package_type: options.packageType,
        package_name: options.packageName,
        page,
        per_page: perPage,
      })

    const versions = (response.data ?? []) as PackageVersionResponse[]

    return {
      items: versions.map((version) => mapPackageVersion(version)),
      totalCount: null,
      page,
      perPage,
      hasNextPage: versions.length === perPage,
    }
  }

  async deletePackage(options: PackageTargetOptions): Promise<void> {
    const scope = await this.resolveOwnerScope(options.owner)

    if (scope === 'orgs') {
      await this.octokit.request('DELETE /orgs/{org}/packages/{package_type}/{package_name}', {
        org: options.owner,
        package_type: options.packageType,
        package_name: options.packageName,
      })
      return
    }

    await this.octokit.request('DELETE /users/{username}/packages/{package_type}/{package_name}', {
      username: options.owner,
      package_type: options.packageType,
      package_name: options.packageName,
    })
  }

  async restorePackage(options: PackageTargetOptions): Promise<void> {
    const scope = await this.resolveOwnerScope(options.owner)

    if (scope === 'orgs') {
      await this.octokit.request('POST /orgs/{org}/packages/{package_type}/{package_name}/restore', {
        org: options.owner,
        package_type: options.packageType,
        package_name: options.packageName,
      })
      return
    }

    await this.octokit.request('POST /users/{username}/packages/{package_type}/{package_name}/restore', {
      username: options.owner,
      package_type: options.packageType,
      package_name: options.packageName,
    })
  }

  async deletePackageVersion(options: PackageVersionTargetOptions): Promise<void> {
    const scope = await this.resolveOwnerScope(options.owner)

    if (scope === 'orgs') {
      await this.octokit.request(
        'DELETE /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}',
        {
          org: options.owner,
          package_type: options.packageType,
          package_name: options.packageName,
          package_version_id: options.versionId,
        },
      )
      return
    }

    await this.octokit.request(
      'DELETE /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}',
      {
        username: options.owner,
        package_type: options.packageType,
        package_name: options.packageName,
        package_version_id: options.versionId,
      },
    )
  }

  async restorePackageVersion(options: PackageVersionTargetOptions): Promise<void> {
    const scope = await this.resolveOwnerScope(options.owner)

    if (scope === 'orgs') {
      await this.octokit.request(
        'POST /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore',
        {
          org: options.owner,
          package_type: options.packageType,
          package_name: options.packageName,
          package_version_id: options.versionId,
        },
      )
      return
    }

    await this.octokit.request(
      'POST /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore',
      {
        username: options.owner,
        package_type: options.packageType,
        package_name: options.packageName,
        package_version_id: options.versionId,
      },
    )
  }

  private async resolveOwnerScope(owner: string): Promise<OwnerScope> {
    const response = await this.octokit.request('GET /users/{username}', { username: owner })
    const data = response.data as { type?: string | null }

    return data.type === 'Organization' ? 'orgs' : 'users'
  }

  private async fetchAllOwnerPackages(
    scope: OwnerScope,
    owner: string,
    packageType: GitHubPackageType,
  ): Promise<OwnerPackagesFetchResult> {
    const items: PackageResponse[] = []
    let truncated = false

    for (let page = 1; page <= MAX_OWNER_PAGES; page += 1) {
      const response = scope === 'orgs'
        ? await this.octokit.request('GET /orgs/{org}/packages', {
          org: owner,
          package_type: packageType,
          page,
          per_page: OWNER_PAGE_SIZE,
        })
        : await this.octokit.request('GET /users/{username}/packages', {
          username: owner,
          package_type: packageType,
          page,
          per_page: OWNER_PAGE_SIZE,
        })

      const pageItems = (response.data ?? []) as PackageResponse[]
      items.push(...pageItems)

      if (pageItems.length < OWNER_PAGE_SIZE) {
        truncated = false
        break
      }

      if (page === MAX_OWNER_PAGES) {
        truncated = true
      }
    }

    return { items, truncated }
  }
}

function matchesRepository(
  repository: RepositoryRefResponse | null | undefined,
  targetOwner: string,
  targetRepo: string,
): boolean {
  const repoName = repository?.name
  const repoOwnerLogin = repository?.owner?.login

  if (!repoName || !repoOwnerLogin) return false

  return repoName.toLowerCase() === targetRepo && repoOwnerLogin.toLowerCase() === targetOwner
}

function compareUpdatedAtDescending(a: string, b: string): number {
  if (a === b) return 0

  return a < b ? 1 : -1
}

function mapPackage(pkg: PackageResponse): GitHubPackage {
  return {
    id: pkg.id ?? 0,
    name: pkg.name ?? '',
    packageType: (pkg.package_type as GitHubPackageType | undefined) ?? 'npm',
    visibility: (pkg.visibility as GitHubPackageVisibility | undefined) ?? 'private',
    versionCount: pkg.version_count ?? 0,
    ownerLogin: pkg.owner?.login ?? '',
    htmlUrl: pkg.html_url ?? null,
    createdAt: pkg.created_at ?? '',
    updatedAt: pkg.updated_at ?? '',
  }
}

function mapPackageVersion(version: PackageVersionResponse): GitHubPackageVersion {
  return {
    id: version.id ?? 0,
    name: version.name ?? '',
    htmlUrl: version.html_url ?? null,
    description: version.description ?? null,
    containerTags: version.metadata?.container?.tags ?? [],
    createdAt: version.created_at ?? '',
    updatedAt: version.updated_at ?? '',
  }
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback

  return Math.max(1, Math.round(value))
}

function normalizePerPage(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback

  return Math.min(MAX_PER_PAGE, Math.max(1, Math.round(value)))
}
