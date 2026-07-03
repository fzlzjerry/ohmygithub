import { describe, expect, it, vi } from 'vitest'
import type { GitHubOctokit } from '../transport'
import { RepositoriesApi } from './repositories'

const REPO = { owner: 'octo-org', repo: 'hello-world' }

function branchListResponse(nodes: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    repository: {
      refs: {
        totalCount: nodes.length,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes,
        ...overrides,
      },
    },
  }
}

describe('RepositoriesApi listBranchesDetailed', () => {
  it('queries branch refs with the default branch as compare head', async () => {
    const { api, graphql } = createApi()
    graphql.mockResolvedValueOnce(branchListResponse([]))

    await api.listBranchesDetailed({
      ...REPO,
      defaultBranch: 'main',
      query: 'feat',
      perPage: 10,
      page: 3,
    })

    expect(graphql).toHaveBeenCalledWith(
      expect.stringContaining('refs(refPrefix: "refs/heads/"'),
      {
        owner: 'octo-org',
        repo: 'hello-world',
        headRef: 'main',
        searchQuery: 'feat',
        first: 10,
        // Offset 20 (= 2 pages x 10) encoded as an unpadded base64 refs cursor.
        after: Buffer.from('20').toString('base64').replace(/=+$/, ''),
      },
    )
  })

  it('requests the first page without a cursor', async () => {
    const { api, graphql } = createApi()
    graphql.mockResolvedValueOnce(branchListResponse([]))

    await api.listBranchesDetailed({ ...REPO, defaultBranch: 'main' })

    expect(graphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ after: undefined }),
    )
  })

  it('resolves the default branch via REST when not provided', async () => {
    const { api, request, graphql } = createApi()
    request.mockResolvedValueOnce({ data: { default_branch: 'trunk' } })
    graphql.mockResolvedValueOnce(branchListResponse([]))

    const page = await api.listBranchesDetailed(REPO)

    expect(request).toHaveBeenCalledWith('GET /repos/{owner}/{repo}', REPO)
    expect(graphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headRef: 'trunk' }),
    )
    expect(page.defaultBranch).toBe('trunk')
  })

  it('swaps compare aheadBy/behindBy to express the branch against the default branch', async () => {
    const { api, graphql } = createApi()
    graphql.mockResolvedValueOnce(branchListResponse([
      {
        name: 'develop',
        branchProtectionRule: null,
        associatedPullRequests: { nodes: [] },
        compare: { aheadBy: 3, behindBy: 5 },
        target: { oid: 'abcdef1234567890', committedDate: '2026-06-25T15:30:00Z', author: null },
      },
    ]))

    const page = await api.listBranchesDetailed({ ...REPO, defaultBranch: 'main' })

    expect(page.items[0]).toMatchObject({ aheadBy: 5, behindBy: 3 })
  })

  it('maps default, protection, pull request, author and null compare', async () => {
    const { api, graphql } = createApi()
    graphql.mockResolvedValueOnce(branchListResponse([
      {
        name: 'main',
        branchProtectionRule: { id: 'BPR_1' },
        associatedPullRequests: { nodes: [] },
        compare: { aheadBy: 0, behindBy: 0 },
        target: {
          oid: '1234567890abcdef',
          committedDate: '2026-06-28T10:00:00Z',
          author: { name: 'The Octocat', avatarUrl: 'https://avatars.example/octocat', user: { login: 'octocat' } },
        },
      },
      {
        name: 'feature/login',
        branchProtectionRule: null,
        associatedPullRequests: {
          nodes: [{ number: 12, title: 'Add login', url: 'https://github.com/octo-org/hello-world/pull/12' }],
        },
        compare: null,
        target: { oid: 'fedcba0987654321', committedDate: null, author: null },
      },
    ], { pageInfo: { hasNextPage: true, endCursor: 'cursor-2' }, totalCount: 42 }))

    const page = await api.listBranchesDetailed({ ...REPO, defaultBranch: 'main' })

    expect(page).toMatchObject({
      totalCount: 42,
      page: 1,
      perPage: 20,
      hasNextPage: true,
      defaultBranch: 'main',
    })
    expect(page.items[0]).toMatchObject({
      name: 'main',
      shortSha: '1234567',
      isDefault: true,
      isProtected: true,
      associatedPullRequest: null,
      author: { login: 'octocat', name: 'The Octocat', avatarUrl: 'https://avatars.example/octocat' },
    })
    expect(page.items[1]).toMatchObject({
      name: 'feature/login',
      isDefault: false,
      isProtected: false,
      aheadBy: null,
      behindBy: null,
      associatedPullRequest: { number: 12, title: 'Add login' },
    })
  })

  it('clamps perPage to the refs page size limit', async () => {
    const { api, graphql } = createApi()
    graphql.mockResolvedValueOnce(branchListResponse([]))

    await api.listBranchesDetailed({ ...REPO, defaultBranch: 'main', perPage: 500 })

    expect(graphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ first: 50 }),
    )
  })
})

describe('RepositoriesApi listTags', () => {
  it('queries tag refs ordered by tag commit date', async () => {
    const { api, graphql } = createApi()
    graphql.mockResolvedValueOnce(branchListResponse([]))

    await api.listTags({ ...REPO, perPage: 25 })

    expect(graphql).toHaveBeenCalledWith(
      expect.stringContaining('refs(refPrefix: "refs/tags/"'),
      expect.objectContaining({ first: 25 }),
    )
    expect(graphql.mock.calls[0][0]).toContain('TAG_COMMIT_DATE')
  })

  it('maps annotated tags with the peeled commit sha and lightweight tags directly', async () => {
    const { api, graphql } = createApi()
    graphql.mockResolvedValueOnce(branchListResponse([
      {
        name: 'v1.2.0',
        target: {
          __typename: 'Tag',
          oid: 'tag-object-sha-000',
          message: 'Release v1.2.0',
          tagger: { date: '2026-06-01T09:00:00Z' },
          target: { oid: 'commit-sha-1234567', committedDate: '2026-05-31T09:00:00Z' },
        },
      },
      {
        name: 'v1.1.0',
        target: { __typename: 'Commit', oid: 'commit-sha-7654321', committedDate: '2026-05-01T09:00:00Z' },
      },
    ]))

    const page = await api.listTags(REPO)

    expect(page.items[0]).toMatchObject({
      name: 'v1.2.0',
      commitSha: 'commit-sha-1234567',
      date: '2026-06-01T09:00:00Z',
      message: 'Release v1.2.0',
      isAnnotated: true,
    })
    expect(page.items[1]).toMatchObject({
      name: 'v1.1.0',
      commitSha: 'commit-sha-7654321',
      date: '2026-05-01T09:00:00Z',
      message: null,
      isAnnotated: false,
    })
  })
})

describe('RepositoriesApi branch mutations', () => {
  it('creates a branch from the base ref head sha', async () => {
    const { api, request } = createApi()
    request.mockResolvedValueOnce({ data: { object: { sha: 'base-sha' } } })
    request.mockResolvedValueOnce({ data: { ref: 'refs/heads/feature/new', object: { sha: 'base-sha' } } })

    const created = await api.createBranch({ ...REPO, name: 'feature/new', fromRef: 'main' })

    expect(request).toHaveBeenNthCalledWith(1, 'GET /repos/{owner}/{repo}/git/ref/{ref}', {
      ...REPO,
      ref: 'heads/main',
    })
    expect(request).toHaveBeenNthCalledWith(2, 'POST /repos/{owner}/{repo}/git/refs', {
      ...REPO,
      ref: 'refs/heads/feature/new',
      sha: 'base-sha',
    })
    expect(created).toEqual({ ref: 'refs/heads/feature/new', sha: 'base-sha' })
  })

  it('renames a branch', async () => {
    const { api, request } = createApi()

    await api.renameBranch({ ...REPO, name: 'old-name', newName: 'new-name' })

    expect(request).toHaveBeenCalledWith('POST /repos/{owner}/{repo}/branches/{branch}/rename', {
      ...REPO,
      branch: 'old-name',
      new_name: 'new-name',
    })
  })

  it('deletes a branch ref', async () => {
    const { api, request } = createApi()

    await api.deleteBranch({ ...REPO, name: 'feature/old' })

    expect(request).toHaveBeenCalledWith('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
      ...REPO,
      ref: 'heads/feature/old',
    })
  })

  it('rejects an empty branch name', async () => {
    const { api } = createApi()

    await expect(api.createBranch({ ...REPO, name: '  ', fromRef: 'main' })).rejects.toThrow('Branch name is required')
    await expect(api.deleteBranch({ ...REPO, name: '' })).rejects.toThrow('Branch name is required')
  })
})

describe('RepositoriesApi tag mutations', () => {
  it('creates a lightweight tag without creating a tag object', async () => {
    const { api, request } = createApi()
    request.mockResolvedValueOnce({ data: { object: { sha: 'commit-sha' } } })
    request.mockResolvedValueOnce({ data: { ref: 'refs/tags/v2.0.0', object: { sha: 'commit-sha' } } })

    const created = await api.createTag({ ...REPO, name: 'v2.0.0', fromRef: 'main' })

    expect(request).not.toHaveBeenCalledWith('POST /repos/{owner}/{repo}/git/tags', expect.anything())
    expect(request).toHaveBeenCalledWith('POST /repos/{owner}/{repo}/git/refs', {
      ...REPO,
      ref: 'refs/tags/v2.0.0',
      sha: 'commit-sha',
    })
    expect(created).toEqual({ ref: 'refs/tags/v2.0.0', sha: 'commit-sha' })
  })

  it('creates an annotated tag object first and points the ref at it', async () => {
    const { api, request } = createApi()
    request.mockResolvedValueOnce({ data: { object: { sha: 'commit-sha' } } })
    request.mockResolvedValueOnce({ data: { sha: 'tag-object-sha' } })
    request.mockResolvedValueOnce({ data: { ref: 'refs/tags/v2.0.0', object: { sha: 'tag-object-sha' } } })

    const created = await api.createTag({ ...REPO, name: 'v2.0.0', fromRef: 'main', message: 'Release v2' })

    expect(request).toHaveBeenNthCalledWith(2, 'POST /repos/{owner}/{repo}/git/tags', {
      ...REPO,
      tag: 'v2.0.0',
      message: 'Release v2',
      object: 'commit-sha',
      type: 'commit',
    })
    expect(request).toHaveBeenNthCalledWith(3, 'POST /repos/{owner}/{repo}/git/refs', {
      ...REPO,
      ref: 'refs/tags/v2.0.0',
      sha: 'tag-object-sha',
    })
    expect(created).toEqual({ ref: 'refs/tags/v2.0.0', sha: 'tag-object-sha' })
  })

  it('deletes a tag ref', async () => {
    const { api, request } = createApi()

    await api.deleteTag({ ...REPO, name: 'v1.0.0' })

    expect(request).toHaveBeenCalledWith('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
      ...REPO,
      ref: 'tags/v1.0.0',
    })
  })
})

function createApi() {
  const request = vi.fn().mockResolvedValue({ data: {} })
  const graphql = vi.fn()
  const api = new RepositoriesApi({ request, graphql } as unknown as GitHubOctokit)

  return { api, request, graphql }
}
