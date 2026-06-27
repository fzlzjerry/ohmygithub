import { Octokit, RequestError } from 'octokit'
import type { GitHubApiOptions } from './types'

export type GitHubOctokit = Octokit

export { RequestError }

export function createOctokit(options: GitHubApiOptions): GitHubOctokit {
  return new Octokit({
    auth: options.token,
    baseUrl: options.baseUrl,
    userAgent: options.userAgent ?? 'oh-my-github'
  })
}
