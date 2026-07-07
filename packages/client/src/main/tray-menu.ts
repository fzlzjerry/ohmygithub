import type { MenuItemConstructorOptions } from 'electron'
import type { GitHubNotification } from '@oh-my-github/api'
import type { StoredWorkspaceBookmark, StoredWorkspaceBookmarkFolder } from './bookmarks'
import type { TrayLabels } from './tray-labels'

export const TRAY_NOTIFICATION_LIMIT = 5

export interface TrayMenuData {
  folders: StoredWorkspaceBookmarkFolder[]
  bookmarks: StoredWorkspaceBookmark[]
  notifications: GitHubNotification[]
  isAuthenticated: boolean
}

export interface TrayMenuHandlers {
  openWindow: () => void
  openSearch: () => void
  navigateBookmark: (url: string) => void
  openNotification: (notification: GitHubNotification) => void
  quit: () => void
}

function disabledRow(label: string): MenuItemConstructorOptions {
  return { label, enabled: false }
}

function bookmarkRow(
  bookmark: StoredWorkspaceBookmark,
  handlers: TrayMenuHandlers
): MenuItemConstructorOptions {
  return { label: bookmark.title, click: () => handlers.navigateBookmark(bookmark.url) }
}

function buildBookmarkRows(
  data: TrayMenuData,
  handlers: TrayMenuHandlers,
  labels: TrayLabels
): MenuItemConstructorOptions[] {
  if (data.folders.length === 0 && data.bookmarks.length === 0) {
    return [disabledRow(labels.noBookmarks)]
  }

  const rows: MenuItemConstructorOptions[] = []

  // Folders first, each a submenu of its bookmarks (mirrors the sidebar order).
  for (const folder of data.folders) {
    const children = data.bookmarks
      .filter((bookmark) => bookmark.folderId === folder.id)
      .map((bookmark) => bookmarkRow(bookmark, handlers))
    rows.push({
      label: folder.title,
      submenu: children.length > 0 ? children : [disabledRow(labels.noBookmarks)]
    })
  }

  // Then root-level bookmarks in their stored order.
  for (const bookmark of data.bookmarks) {
    if (bookmark.folderId === null) {
      rows.push(bookmarkRow(bookmark, handlers))
    }
  }

  return rows
}

function buildInboxRows(
  data: TrayMenuData,
  handlers: TrayMenuHandlers,
  labels: TrayLabels
): MenuItemConstructorOptions[] {
  if (!data.isAuthenticated) {
    return [disabledRow(labels.signInForInbox)]
  }

  if (data.notifications.length === 0) {
    return [disabledRow(labels.noNotifications)]
  }

  return data.notifications.slice(0, TRAY_NOTIFICATION_LIMIT).map((notification) => ({
    label: notification.subjectTitle,
    click: () => handlers.openNotification(notification)
  }))
}

export function buildTrayMenuTemplate(
  data: TrayMenuData,
  handlers: TrayMenuHandlers,
  labels: TrayLabels
): MenuItemConstructorOptions[] {
  return [
    { label: labels.openWindow, click: () => handlers.openWindow() },
    { label: labels.searchWorkspace, click: () => handlers.openSearch() },
    { type: 'separator' },
    disabledRow(labels.bookmarks),
    ...buildBookmarkRows(data, handlers, labels),
    { type: 'separator' },
    disabledRow(labels.inbox),
    ...buildInboxRows(data, handlers, labels),
    { type: 'separator' },
    { label: labels.quit, click: () => handlers.quit() }
  ]
}
