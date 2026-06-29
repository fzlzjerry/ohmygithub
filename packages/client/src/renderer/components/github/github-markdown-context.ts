import type { ComputedRef, InjectionKey } from 'vue'

export interface GitHubMarkdownContext {
  owner?: string | null
  repo?: string | null
}

export const GITHUB_MARKDOWN_CONTEXT_KEY: InjectionKey<ComputedRef<GitHubMarkdownContext>> = Symbol(
  'github-markdown-context',
)
