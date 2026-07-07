import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import type { GitHubNotification } from '@oh-my-github/api'
import type { StoredWorkspaceBookmark, StoredWorkspaceBookmarkFolder } from './bookmarks'
import { getTrayLabels } from './tray-labels'
import { buildTrayMenuTemplate, TRAY_NOTIFICATION_LIMIT, type TrayMenuHandlers } from './tray-menu'

const labels = getTrayLabels('en')

function noopHandlers(): TrayMenuHandlers {
  return {
    openWindow: vi.fn(),
    openSearch: vi.fn(),
    navigateBookmark: vi.fn(),
    openNotification: vi.fn(),
    quit: vi.fn()
  }
}

function folder(id: string, title: string): StoredWorkspaceBookmarkFolder {
  return { id, title, createdAt: '', updatedAt: '' }
}

function bookmark(id: string, title: string, folderId: string | null): StoredWorkspaceBookmark {
  return { id, url: `/b/${id}`, type: 'repository', title, folderId }
}

function notification(id: string, title: string): GitHubNotification {
  return {
    id,
    unread: true,
    reason: 'subscribed',
    updatedAt: '',
    subjectType: 'PullRequest',
    subjectTitle: title,
    repositoryFullName: 'o/r',
    repositoryHtmlUrl: '',
    number: 1,
    htmlUrl: 'https://github.com/o/r/pull/1'
  }
}

function labelsOf(items: MenuItemConstructorOptions[]): string[] {
  return items.map((item) => (item.type === 'separator' ? '---' : String(item.label)))
}

describe('buildTrayMenuTemplate', () => {
  it('renders the fixed top rows and Quit', () => {
    const template = buildTrayMenuTemplate(
      { folders: [], bookmarks: [], notifications: [], isAuthenticated: true },
      noopHandlers(),
      labels
    )
    const flat = labelsOf(template)
    expect(flat[0]).toBe('Open Oh My GitHub')
    expect(flat[1]).toBe('Search Workspace')
    expect(flat).toContain('Bookmarks')
    expect(flat).toContain('Inbox')
    expect(flat.at(-1)).toBe('Quit')

    const bookmarksIdx = flat.indexOf('Bookmarks')
    expect(template[bookmarksIdx].enabled).toBe(false)

    const inboxIdx = flat.indexOf('Inbox')
    expect(template[inboxIdx].enabled).toBe(false)
  })

  it('orders folders (as submenus) before root bookmarks, mirroring the sidebar', () => {
    const template = buildTrayMenuTemplate(
      {
        folders: [folder('f1', 'Folder A')],
        bookmarks: [bookmark('b1', 'In Folder', 'f1'), bookmark('b2', 'Root One', null)],
        notifications: [],
        isAuthenticated: true
      },
      noopHandlers(),
      labels
    )
    const bookmarksHeaderIndex = labelsOf(template).indexOf('Bookmarks')
    const folderRow = template[bookmarksHeaderIndex + 1]
    const rootRow = template[bookmarksHeaderIndex + 2]
    expect(folderRow.label).toBe('Folder A')
    expect(folderRow.submenu).toBeDefined()
    expect((folderRow.submenu as MenuItemConstructorOptions[])[0].label).toBe('In Folder')
    expect(rootRow.label).toBe('Root One')
  })

  it('shows a disabled placeholder in an empty folder', () => {
    const template = buildTrayMenuTemplate(
      { folders: [folder('f1', 'Empty')], bookmarks: [], notifications: [], isAuthenticated: true },
      noopHandlers(),
      labels
    )
    const bookmarksHeaderIndex = labelsOf(template).indexOf('Bookmarks')
    const folderRow = template[bookmarksHeaderIndex + 1]
    const child = (folderRow.submenu as MenuItemConstructorOptions[])[0]
    expect(child.label).toBe('No bookmarks yet')
    expect(child.enabled).toBe(false)
  })

  it('shows the no-bookmarks placeholder when there are none', () => {
    const template = buildTrayMenuTemplate(
      { folders: [], bookmarks: [], notifications: [], isAuthenticated: true },
      noopHandlers(),
      labels
    )
    const idx = labelsOf(template).indexOf('Bookmarks')
    const row = template[idx + 1]
    expect(row.label).toBe('No bookmarks yet')
    expect(row.enabled).toBe(false)
  })

  it('caps notifications at TRAY_NOTIFICATION_LIMIT', () => {
    const notifications = Array.from({ length: 8 }, (_, i) => notification(`n${i}`, `PR ${i}`))
    const template = buildTrayMenuTemplate(
      { folders: [], bookmarks: [], notifications, isAuthenticated: true },
      noopHandlers(),
      labels
    )
    const shown = labelsOf(template).filter((l) => l.startsWith('PR '))
    expect(shown).toHaveLength(TRAY_NOTIFICATION_LIMIT)
  })

  it('shows the sign-in placeholder when unauthenticated', () => {
    const template = buildTrayMenuTemplate(
      { folders: [], bookmarks: [], notifications: [], isAuthenticated: false },
      noopHandlers(),
      labels
    )
    const idx = labelsOf(template).indexOf('Inbox')
    expect(template[idx + 1].label).toBe('Sign in to see your inbox')
    expect(template[idx + 1].enabled).toBe(false)
  })

  it('shows the no-notifications placeholder when authenticated with none', () => {
    const template = buildTrayMenuTemplate(
      { folders: [], bookmarks: [], notifications: [], isAuthenticated: true },
      noopHandlers(),
      labels
    )
    const idx = labelsOf(template).indexOf('Inbox')
    expect(template[idx + 1].label).toBe('No notifications')
    expect(template[idx + 1].enabled).toBe(false)
  })

  it('wires a notification click to openNotification', () => {
    const handlers = noopHandlers()
    const target = notification('n1', 'Click me')
    const template = buildTrayMenuTemplate(
      { folders: [], bookmarks: [], notifications: [target], isAuthenticated: true },
      handlers,
      labels
    )
    const row = template.find((item) => item.label === 'Click me')
    ;(row?.click as () => void)()
    expect(handlers.openNotification).toHaveBeenCalledWith(target)
  })

  it('wires bookmark clicks to navigateBookmark for root and folder-child bookmarks', () => {
    const handlers = noopHandlers()
    const childBookmark = bookmark('b1', 'In Folder', 'f1')
    const rootBookmark = bookmark('b2', 'Root One', null)
    const template = buildTrayMenuTemplate(
      {
        folders: [folder('f1', 'Folder A')],
        bookmarks: [childBookmark, rootBookmark],
        notifications: [],
        isAuthenticated: true
      },
      handlers,
      labels
    )

    const bookmarksHeaderIndex = labelsOf(template).indexOf('Bookmarks')
    const folderRow = template[bookmarksHeaderIndex + 1]
    const rootRow = template[bookmarksHeaderIndex + 2]

    // Root bookmark click calls navigateBookmark with root bookmark's url
    ;(rootRow.click as () => void)()
    expect(handlers.navigateBookmark).toHaveBeenCalledWith(rootBookmark.url)

    // Folder-child bookmark click calls navigateBookmark with child bookmark's url
    const childRow = (folderRow.submenu as MenuItemConstructorOptions[])[0]
    ;(childRow.click as () => void)()
    expect(handlers.navigateBookmark).toHaveBeenCalledWith(childBookmark.url)
  })
})
