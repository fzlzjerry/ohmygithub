import { describe, expect, it } from 'vitest'
import {
  clampPage,
  filterIssues,
  filterPullRequests,
  matchesIssueState,
  matchesPullRequestState,
  matchesWorkItemSearch,
  pageCount,
  paginate,
} from './work-item-list-filter'

function pullRequest(overrides: Partial<GitHubPullRequest>): GitHubPullRequest {
  return {
    id: 'PR_1',
    owner: 'octo-org',
    repo: 'hello-world',
    repository: 'octo-org/hello-world',
    number: 1,
    title: 'Add feature',
    state: 'open',
    ciState: null,
    author: { login: 'octocat' },
    updatedAt: '2026-06-01T00:00:00Z',
    labels: [],
    url: 'https://github.com/octo-org/hello-world/pull/1',
    hasUpdates: false,
    ...overrides,
  }
}

function issue(overrides: Partial<GitHubIssue>): GitHubIssue {
  return {
    id: 'I_1',
    owner: 'octo-org',
    repo: 'hello-world',
    repository: 'octo-org/hello-world',
    number: 1,
    title: 'Something is broken',
    state: 'open',
    author: { login: 'octocat' },
    updatedAt: '2026-06-01T00:00:00Z',
    labels: [],
    url: 'https://github.com/octo-org/hello-world/issues/1',
    hasUpdates: false,
    ...overrides,
  } as GitHubIssue
}

describe('matchesPullRequestState', () => {
  it('treats draft and open as open', () => {
    expect(matchesPullRequestState('open', 'open')).toBe(true)
    expect(matchesPullRequestState('draft', 'open')).toBe(true)
    expect(matchesPullRequestState('closed', 'open')).toBe(false)
    expect(matchesPullRequestState('merged', 'open')).toBe(false)
  })

  it('treats merged and closed as closed', () => {
    expect(matchesPullRequestState('closed', 'closed')).toBe(true)
    expect(matchesPullRequestState('merged', 'closed')).toBe(true)
    expect(matchesPullRequestState('open', 'closed')).toBe(false)
  })

  it('matches everything for the all filter', () => {
    for (const state of ['open', 'draft', 'closed', 'merged'] as const) {
      expect(matchesPullRequestState(state, 'all')).toBe(true)
    }
  })
})

describe('matchesIssueState', () => {
  it('maps completed and not_planned to closed', () => {
    expect(matchesIssueState('open', 'open')).toBe(true)
    expect(matchesIssueState('completed', 'open')).toBe(false)
    expect(matchesIssueState('completed', 'closed')).toBe(true)
    expect(matchesIssueState('not_planned', 'closed')).toBe(true)
    expect(matchesIssueState('open', 'closed')).toBe(false)
  })

  it('matches everything for the all filter', () => {
    for (const state of ['open', 'completed', 'not_planned'] as const) {
      expect(matchesIssueState(state, 'all')).toBe(true)
    }
  })
})

describe('matchesWorkItemSearch', () => {
  it('matches empty and whitespace-only queries', () => {
    expect(matchesWorkItemSearch({ number: 7, title: 'Anything' }, '')).toBe(true)
    expect(matchesWorkItemSearch({ number: 7, title: 'Anything' }, '   ')).toBe(true)
  })

  it('matches on title case-insensitively', () => {
    expect(matchesWorkItemSearch({ number: 7, title: 'Fix Login Bug' }, 'login')).toBe(true)
    expect(matchesWorkItemSearch({ number: 7, title: 'Fix Login Bug' }, 'LOGIN')).toBe(true)
    expect(matchesWorkItemSearch({ number: 7, title: 'Fix Login Bug' }, 'logout')).toBe(false)
  })

  it('matches on issue number with or without a leading hash', () => {
    expect(matchesWorkItemSearch({ number: 42, title: 'Anything' }, '42')).toBe(true)
    expect(matchesWorkItemSearch({ number: 42, title: 'Anything' }, '#42')).toBe(true)
    expect(matchesWorkItemSearch({ number: 42, title: 'Anything' }, '#7')).toBe(false)
  })
})

describe('filterPullRequests', () => {
  const pullRequests = [
    pullRequest({ number: 1, title: 'Open work', state: 'open' }),
    pullRequest({ number: 2, title: 'Draft work', state: 'draft' }),
    pullRequest({ number: 3, title: 'Merged work', state: 'merged' }),
    pullRequest({ number: 4, title: 'Closed work', state: 'closed' }),
  ]

  it('filters by state', () => {
    expect(filterPullRequests(pullRequests, 'open', '').map((pr) => pr.number)).toEqual([1, 2])
    expect(filterPullRequests(pullRequests, 'closed', '').map((pr) => pr.number)).toEqual([3, 4])
    expect(filterPullRequests(pullRequests, 'all', '').map((pr) => pr.number)).toEqual([1, 2, 3, 4])
  })

  it('combines state and search', () => {
    expect(filterPullRequests(pullRequests, 'all', 'merged').map((pr) => pr.number)).toEqual([3])
  })
})

describe('filterIssues', () => {
  const issues = [
    issue({ number: 1, title: 'Open issue', state: 'open' }),
    issue({ number: 2, title: 'Done issue', state: 'completed' }),
    issue({ number: 3, title: 'Wontfix issue', state: 'not_planned' }),
  ]

  it('filters by state', () => {
    expect(filterIssues(issues, 'open', '').map((it) => it.number)).toEqual([1])
    expect(filterIssues(issues, 'closed', '').map((it) => it.number)).toEqual([2, 3])
    expect(filterIssues(issues, 'all', '').map((it) => it.number)).toEqual([1, 2, 3])
  })
})

describe('pagination', () => {
  const items = Array.from({ length: 45 }, (_, index) => index + 1)

  it('computes the page count', () => {
    expect(pageCount(45, 20)).toBe(3)
    expect(pageCount(0, 20)).toBe(1)
    expect(pageCount(20, 20)).toBe(1)
  })

  it('clamps out-of-range pages', () => {
    expect(clampPage(0, 45, 20)).toBe(1)
    expect(clampPage(5, 45, 20)).toBe(3)
    expect(clampPage(2, 45, 20)).toBe(2)
  })

  it('slices the requested page', () => {
    expect(paginate(items, 1, 20)).toHaveLength(20)
    expect(paginate(items, 3, 20)).toEqual([41, 42, 43, 44, 45])
    expect(paginate(items, 1, 20)[0]).toBe(1)
  })
})
