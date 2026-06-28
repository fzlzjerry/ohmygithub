import type { WorkspaceBookmark, WorkspaceSidebarTreeItem } from './types'
import {
  Book,
  Building2,
  CircleDot,
  GitPullRequest,
} from 'lucide-vue-next'
import { getWorkspaceTabView } from './tab-presentation'

export interface WorkspaceSidebarTreeLabels {
  issues: string
  pullRequests: string
}

interface TreeItemContext {
  activeItemId: string | null
  activeUrl: string
  labels: WorkspaceSidebarTreeLabels
  scope: string
}

interface RepositoryLike {
  name: string
  nameWithOwner: string
  owner: string
}

interface RepositoryTreeItemOptions extends TreeItemContext {
  id?: string
  label?: string
  url?: string
}

export function organizationUrl(login: string): string {
  return `/${login}?type=org`
}

export function organizationFallback(login: string): string {
  return login.slice(0, 1).toUpperCase()
}

export function organizationToTreeItem(
  organization: GitHubOrganization,
  context: TreeItemContext,
): WorkspaceSidebarTreeItem {
  const url = organizationUrl(organization.login)
  const itemId = scopedId(context.scope, `org:${organization.login}`)

  return {
    id: itemId,
    label: organization.login,
    url,
    avatarUrl: organization.avatarUrl,
    avatarFallback: organizationFallback(organization.login),
    isActive: isActiveItem(itemId, url, context),
    canExpand: true,
    forceExpanded: shouldForceExpand(itemId, isOwnerDescendantUrl(context.activeUrl, organization.login), context),
    childrenLoader: {
      type: 'organization-repositories',
      owner: organization.login,
      scope: itemId,
    },
  }
}

export function bookmarkToTreeItem(
  bookmark: WorkspaceBookmark,
  context: Omit<TreeItemContext, 'scope'>,
): WorkspaceSidebarTreeItem {
  if (bookmark.type === 'org' && bookmark.owner) {
    const itemId = bookmarkItemId(bookmark)

    return {
      id: itemId,
      label: bookmark.title,
      url: bookmark.url,
      icon: bookmark.avatarUrl ? undefined : Building2,
      avatarUrl: bookmark.avatarUrl,
      avatarFallback: bookmark.avatarFallback ?? organizationFallback(bookmark.owner),
      isActive: isActiveItem(itemId, bookmark.url, context),
      canExpand: true,
      forceExpanded: shouldForceExpand(itemId, isOwnerDescendantUrl(context.activeUrl, bookmark.owner), context),
      childrenLoader: {
        type: 'organization-repositories',
        owner: bookmark.owner,
        scope: itemId,
      },
    }
  }

  if (bookmark.type === 'repo' && bookmark.owner && bookmark.repo) {
    return repositoryToTreeItem(
      {
        name: bookmark.repo,
        nameWithOwner: `${bookmark.owner}/${bookmark.repo}`,
        owner: bookmark.owner,
      },
      {
        ...context,
        id: bookmarkItemId(bookmark),
        label: bookmark.title,
        scope: bookmarkItemId(bookmark),
        url: bookmark.url,
      },
    )
  }

  const view = getWorkspaceTabView(bookmark)

  return {
    id: bookmarkItemId(bookmark),
    label: bookmark.title,
    url: bookmark.url,
    icon: bookmark.avatarUrl ? undefined : view.icon,
    avatarUrl: bookmark.avatarUrl,
    avatarFallback: bookmark.avatarFallback,
    isActive: isActiveItem(bookmarkItemId(bookmark), bookmark.url, context),
  }
}

export function repositoryToTreeItem(
  repository: RepositoryLike,
  options: RepositoryTreeItemOptions,
): WorkspaceSidebarTreeItem {
  const url = options.url ?? repositoryUrl(repository.owner, repository.name)
  const itemId = options.id ?? scopedId(options.scope, `repo:${repository.nameWithOwner}`)

  return {
    id: itemId,
    label: options.label ?? repository.name,
    url,
    icon: Book,
    isActive: isActiveItem(itemId, url, options),
    forceExpanded: shouldForceExpand(
      itemId,
      isRepositoryDescendantUrl(options.activeUrl, repository.owner, repository.name),
      options,
    ),
    children: createRepositoryChildren({
      activeItemId: options.activeItemId,
      activeUrl: options.activeUrl,
      labels: options.labels,
      nameWithOwner: repository.nameWithOwner,
      owner: repository.owner,
      repo: repository.name,
      scope: itemId,
    }),
  }
}

function createRepositoryChildren(options: {
  activeItemId: string | null
  activeUrl: string
  labels: WorkspaceSidebarTreeLabels
  nameWithOwner: string
  owner: string
  repo: string
  scope: string
}): WorkspaceSidebarTreeItem[] {
  const url = repositoryUrl(options.owner, options.repo)

  return [
    {
      id: scopedId(options.scope, `repo-pull-requests:${options.nameWithOwner}`),
      label: options.labels.pullRequests,
      icon: GitPullRequest,
      canExpand: true,
      forceExpanded: shouldForceExpand(
        scopedId(options.scope, `repo-pull-requests:${options.nameWithOwner}`),
        options.activeUrl.startsWith(`${url}/pull/`),
        options,
      ),
      childrenLoader: {
        type: 'repository-pull-requests',
        owner: options.owner,
        repo: options.repo,
        scope: scopedId(options.scope, `repo-pull-requests:${options.nameWithOwner}`),
      },
    },
    {
      id: scopedId(options.scope, `repo-issues:${options.nameWithOwner}`),
      label: options.labels.issues,
      icon: CircleDot,
      canExpand: true,
      forceExpanded: shouldForceExpand(
        scopedId(options.scope, `repo-issues:${options.nameWithOwner}`),
        options.activeUrl.startsWith(`${url}/issues/`),
        options,
      ),
      childrenLoader: {
        type: 'repository-issues',
        owner: options.owner,
        repo: options.repo,
        scope: scopedId(options.scope, `repo-issues:${options.nameWithOwner}`),
      },
    },
  ]
}

function bookmarkItemId(bookmark: WorkspaceBookmark): string {
  return `bookmark:${bookmark.id}`
}

function repositoryUrl(owner: string, repo: string): string {
  return `/${owner}/${repo}`
}

function scopedId(scope: string, id: string): string {
  return `${scope}:${id}`
}

function isActiveItem(
  itemId: string,
  url: string,
  context: { activeItemId: string | null; activeUrl: string },
): boolean {
  return context.activeItemId ? context.activeItemId === itemId : context.activeUrl === url
}

function shouldForceExpand(
  itemId: string,
  fallback: boolean,
  context: { activeItemId: string | null },
): boolean {
  return context.activeItemId ? context.activeItemId.startsWith(`${itemId}:`) : fallback
}

function isOwnerDescendantUrl(url: string, owner: string): boolean {
  return url.startsWith(`/${owner}/`)
}

function isRepositoryDescendantUrl(url: string, owner: string, repo: string): boolean {
  return url.startsWith(`${repositoryUrl(owner, repo)}/`)
}
