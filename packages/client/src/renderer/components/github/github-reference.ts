export interface ParsedGitHubReference {
  owner: string
  repo: string
  number: number
  kindHint: GitHubRepositoryReferenceKind
  url: string
}

export interface TrimmedUrlCandidate {
  value: string
  trailing: string
}

const GITHUB_REFERENCE_TYPES: Record<string, GitHubRepositoryReferenceKind | undefined> = {
  issues: 'issue',
  pull: 'pull-request',
  pulls: 'pull-request',
}

export function parseGitHubReferenceUrl(value: string): ParsedGitHubReference | null {
  const trimmed = trimUrlCandidate(value).value

  try {
    const url = new URL(trimmed)
    if (url.hostname.toLowerCase() !== 'github.com') return null

    const [owner, repo, type, rawNumber] = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
    const kindHint = GITHUB_REFERENCE_TYPES[type]
    const number = Number(rawNumber)

    if (!owner || !repo || !kindHint || !Number.isInteger(number) || number <= 0) {
      return null
    }

    return {
      owner,
      repo,
      number,
      kindHint,
      url: trimmed,
    }
  } catch {
    return null
  }
}

export function trimUrlCandidate(value: string): TrimmedUrlCandidate {
  let candidate = value.trim()
  let trailing = ''

  while (candidate.length > 0 && /[),.;:!?]/.test(candidate[candidate.length - 1])) {
    const nextTrailing = candidate[candidate.length - 1] + trailing
    const nextCandidate = candidate.slice(0, -1)

    if (nextTrailing.startsWith(')') && unmatchedOpeningParenCount(nextCandidate) > 0) {
      break
    }

    candidate = nextCandidate
    trailing = nextTrailing
  }

  return { value: candidate, trailing }
}

export function createGitHubAvatarUrl(login: string, size = 40): string {
  return `https://github.com/${encodeURIComponent(login)}.png?size=${encodeURIComponent(String(size))}`
}

export function createAccountWorkspaceUrl(login: string): string {
  return `/${encodeURIComponent(login)}`
}

export function createReferenceWorkspaceUrl(
  owner: string,
  repo: string,
  kind: GitHubRepositoryReferenceKind,
  number: number,
): string {
  const itemPath = kind === 'pull-request' ? 'pull' : 'issues'

  return `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${itemPath}/${encodeURIComponent(String(number))}`
}

function unmatchedOpeningParenCount(value: string): number {
  let count = 0

  for (const character of value) {
    if (character === '(') count += 1
    else if (character === ')' && count > 0) count -= 1
  }

  return count
}
