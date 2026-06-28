import { AccountsApi } from './modules/accounts'
import { AuthApi } from './modules/auth'
import { InboxApi } from './modules/inbox'
import { IssuesApi } from './modules/issues'
import { PullsApi } from './modules/pulls'
import { createOctokit, type GitHubOctokit } from './transport'
import type {
  GitHubApiOptions,
  GitHubClient,
  GitHubIssue,
  GitHubOrganization,
  GitHubPullRequest,
  GitHubRepository,
  GitHubWorkspaceItem
} from './types'

export interface GitHubApi extends GitHubClient {
  readonly octokit: GitHubOctokit
  readonly accounts: AccountsApi
  readonly auth: AuthApi
  readonly inbox: InboxApi
  readonly issues: IssuesApi
  readonly pulls: PullsApi
}

export function createGitHubApi(options: GitHubApiOptions): GitHubApi {
  const octokit = createOctokit(options)
  const accounts = new AccountsApi(octokit)
  const auth = new AuthApi({ octokit, proxyUrl: options.proxyUrl })
  const inbox = new InboxApi(octokit)
  const issues = new IssuesApi(octokit)
  const pulls = new PullsApi(octokit)

  return {
    octokit,
    accounts,
    auth,
    inbox,
    issues,
    pulls,
    listViewerOrganizations: () => accounts.listViewerOrganizations(),
    listOrganizationRepositories: (owner) => accounts.listOrganizationRepositories(owner),
    listNotifications: () => inbox.listNotifications(),
    listPullRequests: () => inbox.listPullRequests(),
    listIssues: () => inbox.listIssues(),
    listPullRequestCategory: (options) => pulls.listPullRequestCategory(options),
    listViewerPullRequests: (options) => pulls.listViewerPullRequests(options),
    listRepositoryPullRequests: (options) => pulls.listRepositoryPullRequests(options),
    listIssueCategory: (options) => issues.listIssueCategory(options),
    listViewerIssues: (options) => issues.listViewerIssues(options),
    listRepositoryIssues: (options) => issues.listRepositoryIssues(options)
  }
}

export type { GitHubIssue, GitHubOrganization, GitHubPullRequest, GitHubRepository, GitHubWorkspaceItem }
