import { describe, expect, it, vi } from 'vitest'
import { RequestError, type GitHubOctokit } from '../transport'
import { RepositoriesApi } from './repositories'

describe('RepositoriesApi subscription', () => {
  it('subscribes to all activity', async () => {
    const { api, request } = createApi()

    await api.setSubscription({
      owner: 'octo-org',
      repo: 'hello-world',
      subscription: 'all',
    })

    expect(request).toHaveBeenCalledWith('PUT /repos/{owner}/{repo}/subscription', {
      owner: 'octo-org',
      repo: 'hello-world',
      subscribed: true,
      ignored: false,
    })
  })

  it('ignores the repository', async () => {
    const { api, request } = createApi()

    await api.setSubscription({
      owner: 'octo-org',
      repo: 'hello-world',
      subscription: 'ignore',
    })

    expect(request).toHaveBeenCalledWith('PUT /repos/{owner}/{repo}/subscription', {
      owner: 'octo-org',
      repo: 'hello-world',
      subscribed: false,
      ignored: true,
    })
  })

  it('deletes the subscription for participating', async () => {
    const { api, request } = createApi()

    await api.setSubscription({
      owner: 'octo-org',
      repo: 'hello-world',
      subscription: 'participating',
    })

    expect(request).toHaveBeenCalledWith('DELETE /repos/{owner}/{repo}/subscription', {
      owner: 'octo-org',
      repo: 'hello-world',
    })
  })

  it('reports an ignored subscription in the viewer state', async () => {
    const { api } = createApi({ subscription: { subscribed: false, ignored: true } })

    const state = await api.getViewerState({ owner: 'octo-org', repo: 'hello-world' })

    expect(state.subscription).toBe('ignore')
    expect(state.isWatching).toBe(false)
  })

  it('reports an all-activity subscription in the viewer state', async () => {
    const { api } = createApi({ subscription: { subscribed: true, ignored: false } })

    const state = await api.getViewerState({ owner: 'octo-org', repo: 'hello-world' })

    expect(state.subscription).toBe('all')
    expect(state.isWatching).toBe(true)
  })

  it('falls back to participating when no subscription exists', async () => {
    const { api } = createApi()

    const state = await api.getViewerState({ owner: 'octo-org', repo: 'hello-world' })

    expect(state.subscription).toBe('participating')
    expect(state.isWatching).toBe(false)
  })
})

describe('RepositoriesApi fork', () => {
  it('forks under the viewer account with a custom name', async () => {
    const { api, request } = createApi()

    const fork = await api.fork({
      owner: 'octo-org',
      repo: 'hello-world',
      name: 'hello-world-copy',
      defaultBranchOnly: false,
    })

    expect(request).toHaveBeenCalledWith('POST /repos/{owner}/{repo}/forks', {
      owner: 'octo-org',
      repo: 'hello-world',
      name: 'hello-world-copy',
      default_branch_only: false,
    })
    expect(fork).toEqual({
      owner: 'octocat',
      name: 'hello-world-copy',
      nameWithOwner: 'octocat/hello-world-copy',
      url: 'https://github.com/octocat/hello-world-copy',
      ready: true,
    })
  })

  it('forks into an organization and copies the default branch by default', async () => {
    const { api, request } = createApi()

    await api.fork({
      owner: 'octo-org',
      repo: 'hello-world',
      organization: 'fork-org',
    })

    expect(request).toHaveBeenCalledWith('POST /repos/{owner}/{repo}/forks', {
      owner: 'octo-org',
      repo: 'hello-world',
      organization: 'fork-org',
      default_branch_only: true,
    })
  })

  it('waits until the fork responds before reporting it ready', async () => {
    const { api, request } = createApi({ forkNotFoundAttempts: 2 })
    vi.useFakeTimers()

    try {
      const forkPromise = api.fork({
        owner: 'octo-org',
        repo: 'hello-world',
      })
      await vi.runAllTimersAsync()
      const fork = await forkPromise

      expect(fork.ready).toBe(true)
      expect(request.mock.calls.filter(([route]) => route === 'GET /repos/{owner}/{repo}').length).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })
})

function createApi(options: {
  subscription?: { subscribed: boolean, ignored: boolean }
  forkNotFoundAttempts?: number
} = {}) {
  let remainingForkNotFound = options.forkNotFoundAttempts ?? 0

  const request = vi.fn(async (route: string, params?: Record<string, unknown>) => {
    if (route === 'PUT /repos/{owner}/{repo}/subscription') return { data: {} }
    if (route === 'DELETE /repos/{owner}/{repo}/subscription') return { data: {} }

    if (route === 'GET /repos/{owner}/{repo}/subscription') {
      if (options.subscription) return { data: options.subscription }
      throw notFoundError()
    }

    if (route === 'GET /user/starred/{owner}/{repo}') {
      throw notFoundError()
    }

    if (route === 'POST /repos/{owner}/{repo}/forks') {
      const name = (params?.name as string | undefined) ?? (params?.repo as string)
      const owner = (params?.organization as string | undefined) ?? 'octocat'

      return {
        data: {
          name,
          full_name: `${owner}/${name}`,
          owner: { login: owner },
          html_url: `https://github.com/${owner}/${name}`,
        },
      }
    }

    if (route === 'GET /repos/{owner}/{repo}') {
      if (remainingForkNotFound > 0) {
        remainingForkNotFound -= 1
        throw notFoundError()
      }

      return {
        data: {
          name: params?.repo,
          full_name: `${params?.owner}/${params?.repo}`,
          owner: { login: params?.owner },
          stargazers_count: 10,
        },
      }
    }

    throw notFoundError()
  })

  const api = new RepositoriesApi({ request } as unknown as GitHubOctokit)

  return { api, request }
}

function notFoundError() {
  return new RequestError('not found', 404, {
    request: {
      method: 'GET',
      url: 'https://api.github.com/test',
      headers: {},
    },
  })
}
