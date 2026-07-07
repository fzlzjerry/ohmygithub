export type TrayLanguage = 'en' | 'zh'

export interface TrayLabels {
  openWindow: string
  searchWorkspace: string
  bookmarks: string
  inbox: string
  quit: string
  noBookmarks: string
  noNotifications: string
  signInForInbox: string
}

const LABELS: Record<TrayLanguage, TrayLabels> = {
  en: {
    openWindow: 'Open Oh My GitHub',
    searchWorkspace: 'Search Workspace',
    bookmarks: 'Bookmarks',
    inbox: 'Inbox',
    quit: 'Quit',
    noBookmarks: 'No bookmarks yet',
    noNotifications: 'No notifications',
    signInForInbox: 'Sign in to see your inbox'
  },
  zh: {
    openWindow: '打开 Oh My GitHub',
    searchWorkspace: '搜索工作区',
    bookmarks: '书签',
    inbox: '收件箱',
    quit: '退出',
    noBookmarks: '暂无书签',
    noNotifications: '暂无通知',
    signInForInbox: '登录后查看收件箱'
  }
}

export function getTrayLabels(language: TrayLanguage): TrayLabels {
  return LABELS[language]
}
