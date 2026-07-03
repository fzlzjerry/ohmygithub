import { describe, expect, it, vi } from 'vitest'
import type { GitHubOctokit } from '../transport'
import { PackagesApi } from './packages'

const PACKAGE_TYPES = ['npm', 'maven', 'rubygems', 'docker', 'nuget', 'container'] as const

describe('PackagesApi owner scope resolution', () => {
  it('resolves an organization owner and routes package listing through /orgs', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'Organization' } })
      }
      return Promise.resolve({ data: [] })
    })

    await api.listRepositoryPackages({ owner: 'octo-org', repo: 'hello-world' })

    expect(request).toHaveBeenCalledWith('GET /users/{username}', { username: 'octo-org' })
    expect(request).toHaveBeenCalledWith(
      'GET /orgs/{org}/packages',
      expect.objectContaining({ org: 'octo-org', package_type: 'npm', page: 1, per_page: 100 }),
    )
    expect(request).not.toHaveBeenCalledWith('GET /users/{username}/packages', expect.anything())
  })

  it('resolves a user owner and routes package listing through /users', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      return Promise.resolve({ data: [] })
    })

    await api.listRepositoryPackages({ owner: 'octocat', repo: 'hello-world' })

    expect(request).toHaveBeenCalledWith(
      'GET /users/{username}/packages',
      expect.objectContaining({ username: 'octocat', package_type: 'npm', page: 1, per_page: 100 }),
    )
    expect(request).not.toHaveBeenCalledWith('GET /orgs/{org}/packages', expect.anything())
  })

  it('resolves scope only once per listRepositoryPackages call', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      return Promise.resolve({ data: [] })
    })

    await api.listRepositoryPackages({ owner: 'octocat', repo: 'hello-world' })

    const scopeCalls = request.mock.calls.filter(([route]) => route === 'GET /users/{username}')
    expect(scopeCalls).toHaveLength(1)
  })
})

describe('PackagesApi listRepositoryPackages fan-out', () => {
  it('requests all 6 package types exactly once on a short first page', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      return Promise.resolve({ data: [] })
    })

    await api.listRepositoryPackages({ owner: 'octocat', repo: 'hello-world' })

    for (const packageType of PACKAGE_TYPES) {
      const calls = request.mock.calls.filter(
        ([route, params]) => route === 'GET /users/{username}/packages' && (params as { package_type: string }).package_type === packageType,
      )
      expect(calls).toHaveLength(1)
    }
  })

  it('filters by repository name and owner login case-insensitively, dropping null repositories', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string, params?: unknown) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      if (route === 'GET /users/{username}/packages') {
        const typedParams = params as { package_type: string }
        if (typedParams.package_type === 'npm') {
          return Promise.resolve({
            data: [
              createPackage({ id: 1, name: 'match-case', repoName: 'Hello-World', repoOwner: 'OctoCat' }),
              createPackage({ id: 2, name: 'no-match', repoName: 'other-repo', repoOwner: 'octocat' }),
              createPackage({ id: 3, name: 'null-repo', repository: null }),
            ],
          })
        }
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: [] })
    })

    const page = await api.listRepositoryPackages({ owner: 'octocat', repo: 'hello-world' })

    expect(page.items.map((item) => item.name)).toEqual(['match-case'])
    expect(page.totalCount).toBe(1)
  })

  it('merges all types, sorts by updated_at descending, and paginates locally', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string, params?: unknown) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      if (route === 'GET /users/{username}/packages') {
        const packageType = (params as { package_type: string }).package_type

        if (packageType === 'npm') {
          return Promise.resolve({
            data: [
              createPackage({ id: 1, name: 'npm-old', updatedAt: '2026-01-01T00:00:00Z' }),
              createPackage({ id: 2, name: 'npm-new', updatedAt: '2026-06-01T00:00:00Z' }),
            ],
          })
        }
        if (packageType === 'docker') {
          return Promise.resolve({
            data: [createPackage({ id: 3, name: 'docker-mid', updatedAt: '2026-03-01T00:00:00Z' })],
          })
        }
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: [] })
    })

    const page = await api.listRepositoryPackages({ owner: 'octocat', repo: 'hello-world', page: 1, perPage: 2 })

    expect(page.items.map((item) => item.name)).toEqual(['npm-new', 'docker-mid'])
    expect(page.totalCount).toBe(3)
    expect(page.page).toBe(1)
    expect(page.perPage).toBe(2)
    expect(page.hasNextPage).toBe(true)

    const page2 = await api.listRepositoryPackages({ owner: 'octocat', repo: 'hello-world', page: 2, perPage: 2 })
    expect(page2.items.map((item) => item.name)).toEqual(['npm-old'])
    expect(page2.hasNextPage).toBe(false)
  })

  it('paginates through subsequent pages for a type until a short page is returned', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string, params?: unknown) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      if (route === 'GET /users/{username}/packages') {
        const { package_type: packageType, page } = params as { package_type: string; page: number }

        if (packageType === 'npm') {
          if (page === 1) {
            return Promise.resolve({ data: createFullPage('npm', 1) })
          }
          if (page === 2) {
            return Promise.resolve({ data: [createPackage({ id: 9999, name: 'npm-page2' })] })
          }
        }
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: [] })
    })

    const page = await api.listRepositoryPackages({ owner: 'octocat', repo: 'hello-world', perPage: 200 })

    const npmCalls = request.mock.calls.filter(
      ([route, params]) => route === 'GET /users/{username}/packages' && (params as { package_type: string }).package_type === 'npm',
    )
    expect(npmCalls).toHaveLength(2)
    expect(page.truncated).toBe(false)
    expect(page.totalCount).toBe(101)
  })

  it('caps at 3 pages per type and marks truncated when the 3rd page is still full', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string, params?: unknown) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      if (route === 'GET /users/{username}/packages') {
        const { package_type: packageType, page } = params as { package_type: string; page: number }

        if (packageType === 'npm') {
          return Promise.resolve({ data: createFullPage('npm', page) })
        }
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: [] })
    })

    const page = await api.listRepositoryPackages({ owner: 'octocat', repo: 'hello-world', perPage: 500 })

    const npmCalls = request.mock.calls.filter(
      ([route, params]) => route === 'GET /users/{username}/packages' && (params as { package_type: string }).package_type === 'npm',
    )
    expect(npmCalls).toHaveLength(3)
    expect(page.truncated).toBe(true)
  })

  it('records a single failing type in failedTypes without affecting the others', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string, params?: unknown) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      if (route === 'GET /users/{username}/packages') {
        const packageType = (params as { package_type: string }).package_type

        if (packageType === 'docker') {
          return Promise.reject(new Error('boom'))
        }
        if (packageType === 'npm') {
          return Promise.resolve({ data: [createPackage({ id: 1, name: 'npm-ok' })] })
        }
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: [] })
    })

    const page = await api.listRepositoryPackages({ owner: 'octocat', repo: 'hello-world' })

    expect(page.failedTypes).toEqual(['docker'])
    expect(page.items.map((item) => item.name)).toEqual(['npm-ok'])
  })

  it('throws when all 6 package types fail', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      return Promise.reject(new Error('down'))
    })

    await expect(api.listRepositoryPackages({ owner: 'octocat', repo: 'hello-world' })).rejects.toThrow()
  })
})

describe('PackagesApi listPackageVersions', () => {
  it('routes through /orgs and maps container tags when metadata is present', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'Organization' } })
      }
      return Promise.resolve({
        data: [
          {
            id: 1,
            name: 'sha256:abc',
            html_url: 'https://github.com/orgs/octo-org/packages/container/pkg/1',
            description: null,
            metadata: { package_type: 'container', container: { tags: ['latest', 'v1'] } },
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
      })
    })

    const page = await api.listPackageVersions({ owner: 'octo-org', packageType: 'container', packageName: 'pkg' })

    expect(request).toHaveBeenCalledWith(
      'GET /orgs/{org}/packages/{package_type}/{package_name}/versions',
      { org: 'octo-org', package_type: 'container', package_name: 'pkg', page: 1, per_page: 30 },
    )
    expect(page.items[0].containerTags).toEqual(['latest', 'v1'])
    expect(page.totalCount).toBeNull()
  })

  it('routes through /users and defaults containerTags to an empty array without metadata', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      return Promise.resolve({
        data: [
          {
            id: 2,
            name: '1.0.0',
            html_url: null,
            description: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
      })
    })

    const page = await api.listPackageVersions({ owner: 'octocat', packageType: 'npm', packageName: 'left-pad' })

    expect(request).toHaveBeenCalledWith(
      'GET /users/{username}/packages/{package_type}/{package_name}/versions',
      { username: 'octocat', package_type: 'npm', package_name: 'left-pad', page: 1, per_page: 30 },
    )
    expect(page.items[0].containerTags).toEqual([])
  })

  it('infers hasNextPage from a full page since the endpoint has no total count', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      return Promise.resolve({ data: [createVersion(1), createVersion(2)] })
    })

    const page = await api.listPackageVersions({
      owner: 'octocat',
      packageType: 'npm',
      packageName: 'left-pad',
      page: 1,
      perPage: 2,
    })

    expect(page.hasNextPage).toBe(true)
  })
})

describe('PackagesApi admin mutations', () => {
  it('deletes a package via /orgs for an organization owner', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'Organization' } })
      }
      return Promise.resolve({ data: {} })
    })

    await api.deletePackage({ owner: 'octo-org', packageType: 'npm', packageName: 'pkg' })

    expect(request).toHaveBeenCalledWith(
      'DELETE /orgs/{org}/packages/{package_type}/{package_name}',
      { org: 'octo-org', package_type: 'npm', package_name: 'pkg' },
    )
  })

  it('deletes a package via /users for a user owner', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      return Promise.resolve({ data: {} })
    })

    await api.deletePackage({ owner: 'octocat', packageType: 'npm', packageName: 'pkg' })

    expect(request).toHaveBeenCalledWith(
      'DELETE /users/{username}/packages/{package_type}/{package_name}',
      { username: 'octocat', package_type: 'npm', package_name: 'pkg' },
    )
  })

  it('restores a package via /orgs for an organization owner', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'Organization' } })
      }
      return Promise.resolve({ data: {} })
    })

    await api.restorePackage({ owner: 'octo-org', packageType: 'container', packageName: 'pkg/nested' })

    expect(request).toHaveBeenCalledWith(
      'POST /orgs/{org}/packages/{package_type}/{package_name}/restore',
      { org: 'octo-org', package_type: 'container', package_name: 'pkg/nested' },
    )
  })

  it('restores a package via /users for a user owner', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      return Promise.resolve({ data: {} })
    })

    await api.restorePackage({ owner: 'octocat', packageType: 'npm', packageName: 'pkg' })

    expect(request).toHaveBeenCalledWith(
      'POST /users/{username}/packages/{package_type}/{package_name}/restore',
      { username: 'octocat', package_type: 'npm', package_name: 'pkg' },
    )
  })

  it('deletes a package version via /orgs for an organization owner', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'Organization' } })
      }
      return Promise.resolve({ data: {} })
    })

    await api.deletePackageVersion({ owner: 'octo-org', packageType: 'npm', packageName: 'pkg', versionId: 42 })

    expect(request).toHaveBeenCalledWith(
      'DELETE /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}',
      { org: 'octo-org', package_type: 'npm', package_name: 'pkg', package_version_id: 42 },
    )
  })

  it('deletes a package version via /users for a user owner', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      return Promise.resolve({ data: {} })
    })

    await api.deletePackageVersion({ owner: 'octocat', packageType: 'npm', packageName: 'pkg', versionId: 42 })

    expect(request).toHaveBeenCalledWith(
      'DELETE /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}',
      { username: 'octocat', package_type: 'npm', package_name: 'pkg', package_version_id: 42 },
    )
  })

  it('restores a package version via /orgs for an organization owner', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'Organization' } })
      }
      return Promise.resolve({ data: {} })
    })

    await api.restorePackageVersion({ owner: 'octo-org', packageType: 'npm', packageName: 'pkg', versionId: 42 })

    expect(request).toHaveBeenCalledWith(
      'POST /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore',
      { org: 'octo-org', package_type: 'npm', package_name: 'pkg', package_version_id: 42 },
    )
  })

  it('restores a package version via /users for a user owner', async () => {
    const { api, request } = createApi()
    request.mockImplementation((route: string) => {
      if (route === 'GET /users/{username}') {
        return Promise.resolve({ data: { type: 'User' } })
      }
      return Promise.resolve({ data: {} })
    })

    await api.restorePackageVersion({ owner: 'octocat', packageType: 'npm', packageName: 'pkg', versionId: 42 })

    expect(request).toHaveBeenCalledWith(
      'POST /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore',
      { username: 'octocat', package_type: 'npm', package_name: 'pkg', package_version_id: 42 },
    )
  })
})

function createApi() {
  const request = vi.fn().mockResolvedValue({ data: {} })
  const api = new PackagesApi({ request } as unknown as GitHubOctokit)

  return { api, request }
}

function createPackage(options: {
  id: number
  name: string
  repoName?: string
  repoOwner?: string
  repository?: null
  updatedAt?: string
}) {
  return {
    id: options.id,
    name: options.name,
    package_type: 'npm',
    visibility: 'public',
    version_count: 3,
    owner: { login: options.repoOwner ?? 'octocat' },
    repository: options.repository === null
      ? null
      : { name: options.repoName ?? 'hello-world', owner: { login: options.repoOwner ?? 'octocat' } },
    html_url: `https://github.com/octocat/hello-world/packages/${options.id}`,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: options.updatedAt ?? '2026-01-02T00:00:00Z',
  }
}

function createFullPage(name: string, page: number) {
  return Array.from({ length: 100 }, (_, index) => createPackage({
    id: page * 1000 + index,
    name: `${name}-${page}-${index}`,
  }))
}

function createVersion(id: number) {
  return {
    id,
    name: `1.0.${id}`,
    html_url: null,
    description: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  }
}
