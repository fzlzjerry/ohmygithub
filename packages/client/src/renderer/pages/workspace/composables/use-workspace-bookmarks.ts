import type { WorkspaceBookmark, WorkspaceBookmarkFolder, WorkspaceTab } from '../types'
import { computed, ref } from 'vue'
import { createWorkspaceTabFromUrl, isWorkspaceTabType, normalizeWorkspaceUrl } from '../workspace-url'

const STORAGE_KEY = 'oh-my-github:workspace-bookmarks:v1'
const STORAGE_VERSION = 1

export type CreateBookmarkFolderResult =
  | { ok: true; folder: WorkspaceBookmarkFolder }
  | { ok: false; reason: 'duplicate' | 'empty' }

interface StoredWorkspaceBookmarks {
  version: 1
  folders: WorkspaceBookmarkFolder[]
  bookmarks: WorkspaceBookmark[]
}

export function useWorkspaceBookmarks() {
  const restored = readStoredBookmarks()
  const folders = ref<WorkspaceBookmarkFolder[]>(restored.folders)
  const bookmarks = ref<WorkspaceBookmark[]>(restored.bookmarks)

  const bookmarkByUrl = computed(() => {
    return new Map(bookmarks.value.map((bookmark) => [bookmark.url, bookmark]))
  })

  const bookmarkedUrls = computed(() => new Set(bookmarkByUrl.value.keys()))

  function createFolder(title: string): CreateBookmarkFolderResult {
    const normalizedTitle = title.trim()

    if (!normalizedTitle) {
      return { ok: false, reason: 'empty' }
    }

    if (folders.value.some((folder) => folder.title.toLowerCase() === normalizedTitle.toLowerCase())) {
      return { ok: false, reason: 'duplicate' }
    }

    const now = new Date().toISOString()
    const folder: WorkspaceBookmarkFolder = {
      id: createId('folder'),
      title: normalizedTitle,
      createdAt: now,
      updatedAt: now,
    }

    folders.value = [...folders.value, folder]
    persist()

    return { ok: true, folder }
  }

  function addBookmark(input: {
    folderId: string | null
    organization?: GitHubOrganization
    tab: WorkspaceTab
    title: string
  }): void {
    const tab = createWorkspaceTabFromUrl(input.tab.url)
    const existing = bookmarkByUrl.value.get(tab.url)
    const folderId = input.folderId && folders.value.some((folder) => folder.id === input.folderId)
      ? input.folderId
      : null

    const bookmark: WorkspaceBookmark = {
      id: existing?.id ?? createId('bookmark'),
      url: tab.url,
      type: tab.type,
      title: input.title.trim() || tab.title,
      folderId,
      owner: tab.owner,
      repo: tab.repo,
      draftId: tab.draftId,
      number: tab.number,
      pullRequestCategory: tab.pullRequestCategory,
      issueCategory: tab.issueCategory,
      avatarUrl: input.organization?.avatarUrl ?? existing?.avatarUrl,
      avatarFallback: input.organization?.login.slice(0, 1).toUpperCase() ?? existing?.avatarFallback,
    }

    const nextBookmarks = bookmarks.value.filter((item) => item.url !== tab.url)
    bookmarks.value = [...nextBookmarks, bookmark]
    persist()
  }

  function removeBookmark(url: string): void {
    const normalizedUrl = normalizeWorkspaceUrl(url)
    const nextBookmarks = bookmarks.value.filter((bookmark) => bookmark.url !== normalizedUrl)

    if (nextBookmarks.length === bookmarks.value.length) return

    bookmarks.value = nextBookmarks
    persist()
  }

  function getBookmark(url: string): WorkspaceBookmark | undefined {
    return bookmarkByUrl.value.get(normalizeWorkspaceUrl(url))
  }

  function persist(): void {
    persistBookmarks({
      folders: folders.value,
      bookmarks: bookmarks.value,
    })
  }

  return {
    bookmarkedUrls,
    bookmarkByUrl,
    bookmarks,
    createFolder,
    folders,
    getBookmark,
    removeBookmark,
    addBookmark,
  }
}

function readStoredBookmarks(): Pick<StoredWorkspaceBookmarks, 'bookmarks' | 'folders'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { folders: [], bookmarks: [] }
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION) {
      return { folders: [], bookmarks: [] }
    }

    const folders = Array.isArray(parsed.folders)
      ? parsed.folders.map(coerceStoredFolder).filter((folder): folder is WorkspaceBookmarkFolder => Boolean(folder))
      : []
    const folderIds = new Set(folders.map((folder) => folder.id))
    const bookmarks = Array.isArray(parsed.bookmarks)
      ? dedupeBookmarks(
        parsed.bookmarks
          .map((bookmark) => coerceStoredBookmark(bookmark, folderIds))
          .filter((bookmark): bookmark is WorkspaceBookmark => Boolean(bookmark)),
      )
      : []

    return { folders, bookmarks }
  } catch {
    return { folders: [], bookmarks: [] }
  }
}

function persistBookmarks(payload: Pick<StoredWorkspaceBookmarks, 'bookmarks' | 'folders'>): void {
  const stored: StoredWorkspaceBookmarks = {
    version: STORAGE_VERSION,
    folders: payload.folders,
    bookmarks: dedupeBookmarks(payload.bookmarks),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

function coerceStoredFolder(value: unknown): WorkspaceBookmarkFolder | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return null

  const title = value.title.trim()
  if (!title) return null

  return {
    id: value.id,
    title,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

function coerceStoredBookmark(value: unknown, folderIds: Set<string>): WorkspaceBookmark | null {
  if (!isRecord(value)) return null
  if (typeof value.url !== 'string') return null
  if (typeof value.type !== 'string' || !isWorkspaceTabType(value.type)) return null
  if (typeof value.title !== 'string') return null

  const tab = createWorkspaceTabFromUrl(value.url)
  if (tab.type !== value.type) return null

  const folderId = typeof value.folderId === 'string' && folderIds.has(value.folderId)
    ? value.folderId
    : null

  return {
    id: typeof value.id === 'string' ? value.id : createId('bookmark'),
    url: tab.url,
    type: tab.type,
    title: value.title.trim() || tab.title,
    folderId,
    owner: tab.owner,
    repo: tab.repo,
    draftId: tab.draftId,
    number: tab.number,
    pullRequestCategory: tab.pullRequestCategory,
    issueCategory: tab.issueCategory,
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
    avatarFallback: typeof value.avatarFallback === 'string' ? value.avatarFallback : undefined,
  }
}

function dedupeBookmarks(bookmarks: WorkspaceBookmark[]): WorkspaceBookmark[] {
  const seen = new Set<string>()
  const result: WorkspaceBookmark[] = []

  for (const bookmark of bookmarks) {
    if (seen.has(bookmark.url)) continue
    seen.add(bookmark.url)
    result.push(bookmark)
  }

  return result
}

function createId(prefix: string): string {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}:${crypto.randomUUID()}`
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
