import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useQuery } from '@pinia/colada'

export function useWorkspacePullRequestCategory(
  category: MaybeRefOrGetter<GitHubPullRequestCategory>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useQuery<GitHubPullRequest[]>({
    key: () => ['workspace', 'pull-request-category', toValue(category)],
    enabled: () => toValue(enabled),
    query: async () => {
      if (!window.ohMyGithub?.pulls) {
        throw new Error('GitHub pulls bridge is unavailable')
      }

      return window.ohMyGithub.pulls.listPullRequestCategory(toValue(category))
    }
  })
}

export function useWorkspaceViewerPullRequests(enabled: MaybeRefOrGetter<boolean>) {
  return useQuery<GitHubPullRequest[]>({
    key: ['workspace', 'viewer-pull-requests'],
    enabled: () => toValue(enabled),
    query: async () => {
      if (!window.ohMyGithub?.pulls) {
        throw new Error('GitHub pulls bridge is unavailable')
      }

      return window.ohMyGithub.pulls.listViewerPullRequests()
    }
  })
}

export function useWorkspaceRepositoryPullRequests(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useQuery<GitHubPullRequest[]>({
    key: () => ['workspace', 'repository-pull-requests', toValue(owner), toValue(repo)],
    enabled: () => Boolean(toValue(owner)) && Boolean(toValue(repo)) && toValue(enabled),
    query: async () => {
      if (!window.ohMyGithub?.pulls) {
        throw new Error('GitHub pulls bridge is unavailable')
      }

      return window.ohMyGithub.pulls.listRepositoryPullRequests(toValue(owner), toValue(repo))
    }
  })
}
