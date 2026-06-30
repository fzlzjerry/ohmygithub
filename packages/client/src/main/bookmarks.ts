import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { ipcMain } from 'electron'

export interface StoredWorkspaceBookmarkFolder {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface StoredWorkspaceBookmark {
  id: string
  url: string
  type: string
  title: string
  folderId: string | null
  owner?: string
  repo?: string
  number?: number
  runId?: number
  jobId?: number
  accountSection?: string
  repositorySection?: string
  pullRequestCategory?: string
  issueCategory?: string
  searchMode?: string
  searchQuery?: string
  notFoundInput?: string
  avatarUrl?: string
  avatarFallback?: string
}

export interface StoredWorkspaceBookmarks {
  version: 1
  folders: StoredWorkspaceBookmarkFolder[]
  bookmarks: StoredWorkspaceBookmark[]
}

export interface StoredWorkspaceBookmarksInfo {
  path: string
  hasContent: boolean
  bookmarks: StoredWorkspaceBookmarks
}

const bookmarksPath = join(homedir(), '.oh-my-github', 'bookmarks.json')

export function registerBookmarksIpc(): void {
  ipcMain.handle('bookmarks:get', () => readBookmarksInfo())
  ipcMain.handle('bookmarks:update', (_event, payload: StoredWorkspaceBookmarks) => {
    const bookmarks = normalizeBookmarks(payload)
    writeBookmarks(bookmarks)

    return {
      path: bookmarksPath,
      hasContent: hasBookmarksContent(bookmarks),
      bookmarks
    }
  })
}

function readBookmarksInfo(): StoredWorkspaceBookmarksInfo {
  const bookmarks = readBookmarks()

  return {
    path: bookmarksPath,
    hasContent: hasBookmarksContent(bookmarks),
    bookmarks
  }
}

function readBookmarks(): StoredWorkspaceBookmarks {
  try {
    const raw = readFileSync(bookmarksPath, 'utf8')
    if (!raw.trim()) {
      const bookmarks = defaultBookmarks()
      writeBookmarks(bookmarks)
      return bookmarks
    }

    return normalizeBookmarks(JSON.parse(raw) as Partial<StoredWorkspaceBookmarks>)
  } catch (error) {
    if (isMissingFileError(error)) {
      const bookmarks = defaultBookmarks()
      writeBookmarks(bookmarks)
      return bookmarks
    }

    throw error
  }
}

function writeBookmarks(bookmarks: StoredWorkspaceBookmarks): void {
  mkdirSync(dirname(bookmarksPath), { recursive: true })
  writeFileSync(bookmarksPath, `${JSON.stringify(bookmarks, null, 2)}\n`, 'utf8')
}

function normalizeBookmarks(value: unknown): StoredWorkspaceBookmarks {
  if (!isRecord(value)) return defaultBookmarks()

  const folders = Array.isArray(value.folders)
    ? value.folders.map(normalizeFolder).filter((folder): folder is StoredWorkspaceBookmarkFolder => Boolean(folder))
    : []
  const folderIds = new Set(folders.map((folder) => folder.id))
  const bookmarks = Array.isArray(value.bookmarks)
    ? dedupeBookmarks(
      value.bookmarks
        .map((bookmark) => normalizeBookmark(bookmark, folderIds))
        .filter((bookmark): bookmark is StoredWorkspaceBookmark => Boolean(bookmark))
    )
    : []

  return {
    version: 1,
    folders,
    bookmarks
  }
}

function normalizeFolder(value: Partial<StoredWorkspaceBookmarkFolder>): StoredWorkspaceBookmarkFolder | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') return null

  const title = value.title.trim()
  if (!title) return null

  return {
    id: value.id,
    title,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()
  }
}

function normalizeBookmark(
  value: Partial<StoredWorkspaceBookmark>,
  folderIds: Set<string>
): StoredWorkspaceBookmark | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.url !== 'string') return null
  if (typeof value.type !== 'string' || typeof value.title !== 'string') return null

  return {
    id: value.id,
    url: value.url,
    type: value.type,
    title: value.title.trim() || value.url,
    folderId: typeof value.folderId === 'string' && folderIds.has(value.folderId) ? value.folderId : null,
    owner: optionalString(value.owner),
    repo: optionalString(value.repo),
    number: typeof value.number === 'number' && Number.isInteger(value.number) ? value.number : undefined,
    runId: typeof value.runId === 'number' && Number.isInteger(value.runId) ? value.runId : undefined,
    jobId: typeof value.jobId === 'number' && Number.isInteger(value.jobId) ? value.jobId : undefined,
    accountSection: optionalString(value.accountSection),
    repositorySection: optionalString(value.repositorySection),
    pullRequestCategory: optionalString(value.pullRequestCategory),
    issueCategory: optionalString(value.issueCategory),
    searchMode: optionalString(value.searchMode),
    searchQuery: optionalString(value.searchQuery),
    notFoundInput: optionalString(value.notFoundInput),
    avatarUrl: optionalString(value.avatarUrl),
    avatarFallback: optionalString(value.avatarFallback)
  }
}

function dedupeBookmarks(bookmarks: StoredWorkspaceBookmark[]): StoredWorkspaceBookmark[] {
  const seen = new Set<string>()
  const result: StoredWorkspaceBookmark[] = []

  for (const bookmark of bookmarks) {
    if (seen.has(bookmark.url)) continue
    seen.add(bookmark.url)
    result.push(bookmark)
  }

  return result
}

function defaultBookmarks(): StoredWorkspaceBookmarks {
  return {
    version: 1,
    folders: [],
    bookmarks: []
  }
}

function hasBookmarksContent(bookmarks: StoredWorkspaceBookmarks): boolean {
  return bookmarks.folders.length > 0 || bookmarks.bookmarks.length > 0
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}
