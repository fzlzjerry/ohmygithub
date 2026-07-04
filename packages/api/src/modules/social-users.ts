import type { GitHubOctokit } from '../transport'
import type { GitHubAccountFollowUser } from '../types'

export interface FollowUserResponse {
  id?: number
  login?: string
  avatar_url?: string | null
  type?: string | null
}

export interface GraphFollowEnrichmentNode {
  __typename?: string
  name?: string | null
  bio?: string | null
  description?: string | null
  viewerIsFollowing?: boolean
  viewerCanFollow?: boolean
  isFollowingViewer?: boolean
  isViewer?: boolean
}

const ENRICH_CHUNK_SIZE = 100
const WINDOW_FETCH_PAGE_SIZE = 100
const WINDOW_MAX_PAGES = 10

export interface ListWindowPage<T> {
  items: T[]
  link: string
}

export interface ListWindowResult<T> {
  items: T[]
  totalCount: number
  truncated: boolean
}

export interface ListWindowOptions {
  perPage?: number
  maxPages?: number
}

export function parseLastPage(link: string): number {
  const lastPageMatch = link.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/)
  return lastPageMatch ? Number(lastPageMatch[1]) : 1
}

// REST list endpoints return rows oldest-first with no ordering options, so
// the whole (capped) list is fetched from the tail and reversed to render
// newest-first; search and paging then happen client-side.
export async function fetchListWindow<T>(
  fetchPage: (page: number, perPage: number) => Promise<ListWindowPage<T>>,
  options: ListWindowOptions = {},
): Promise<ListWindowResult<T>> {
  const perPage = options.perPage ?? WINDOW_FETCH_PAGE_SIZE
  const maxPages = options.maxPages ?? WINDOW_MAX_PAGES
  const first = await fetchPage(1, perPage)
  const lastPage = parseLastPage(first.link)
  const truncated = lastPage > maxPages
  // When truncated, keep the newest maxPages pages (the tail).
  const windowStart = truncated ? lastPage - maxPages + 1 : 2
  const extraPageNumbers: number[] = []
  for (let pageNumber = windowStart; pageNumber <= lastPage; pageNumber += 1) {
    extraPageNumbers.push(pageNumber)
  }
  const extraPages = await Promise.all(
    extraPageNumbers.map(async (pageNumber) => (await fetchPage(pageNumber, perPage)).items),
  )
  const ascending = truncated ? extraPages.flat() : [...first.items, ...extraPages.flat()]
  const lastPageItems = extraPages.length > 0 ? extraPages[extraPages.length - 1] : first.items

  return {
    items: [...ascending].reverse(),
    totalCount: (lastPage - 1) * perPage + lastPageItems.length,
    truncated,
  }
}

// One aliased repositoryOwner lookup per row adds name/bio and the viewer's
// follow relationship to a plain REST user list, batched 100 logins per query.
export async function enrichFollowAccounts(
  octokit: GitHubOctokit,
  users: FollowUserResponse[],
): Promise<Map<string, GraphFollowEnrichmentNode>> {
  const logins = users
    .map((user) => user.login ?? '')
    .filter((login) => /^[a-zA-Z0-9-]+$/.test(login))
  const enrichments = new Map<string, GraphFollowEnrichmentNode>()

  for (let offset = 0; offset < logins.length; offset += ENRICH_CHUNK_SIZE) {
    const chunk = logins.slice(offset, offset + ENRICH_CHUNK_SIZE)
    const selections = chunk.map((login, index) => `
      o${index}: repositoryOwner(login: "${login}") {
        __typename
        ... on User {
          name
          bio
          viewerIsFollowing
          viewerCanFollow
          isFollowingViewer
          isViewer
        }
        ... on Organization {
          name
          description
          viewerIsFollowing
        }
      }
    `)
    const response = await octokit.graphql<Record<string, GraphFollowEnrichmentNode | null>>(
      `query FollowEnrichment {${selections.join('\n')}}`,
    )

    chunk.forEach((login, index) => {
      const node = response[`o${index}`]
      if (node) enrichments.set(login.toLowerCase(), node)
    })
  }

  return enrichments
}

export function mapFollowUser(
  user: FollowUserResponse,
  enrichment: GraphFollowEnrichmentNode | undefined,
): GitHubAccountFollowUser[] {
  const login = user.login?.trim()
  if (!login) return []

  const isOrganization = (enrichment?.__typename ?? user.type) === 'Organization'

  return [{
    id: user.id ?? 0,
    login,
    name: enrichment?.name ?? null,
    avatarUrl: user.avatar_url ?? `https://github.com/${encodeURIComponent(login)}.png?size=96`,
    bio: (isOrganization ? enrichment?.description : enrichment?.bio) ?? null,
    type: user.type ?? (isOrganization ? 'Organization' : 'User'),
    isViewer: Boolean(enrichment?.isViewer),
    viewerIsFollowing: Boolean(enrichment?.viewerIsFollowing),
    // Organizations expose no viewerCanFollow field; anyone can follow an org.
    viewerCanFollow: enrichment ? (isOrganization ? true : Boolean(enrichment.viewerCanFollow)) : false,
    isFollowingViewer: Boolean(enrichment?.isFollowingViewer),
  }]
}
