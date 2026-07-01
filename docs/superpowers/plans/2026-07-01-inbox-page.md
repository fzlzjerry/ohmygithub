# Inbox Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the top-level Inbox page (`/inbox`) that lists the authenticated user's GitHub notifications with read-only browsing plus basic triage (mark read, mark all read, mark done, unsubscribe).

**Architecture:** Three-tier like the rest of the app: a new `InboxApi.listInboxNotifications` + triage methods in `packages/api` (Octokit `rest.activity`), a `main/inbox.ts` IPC handler, a `window.ohMyGithub.inbox` preload bridge, a `useQuery`-based `use-inbox.ts` composable with plain-async write functions, and an `inbox-page.vue` wired into `workspace-panel.vue`. A dedicated `GitHubNotification` type replaces the lossy `GitHubWorkspaceItem` on the inbox path.

**Tech Stack:** TypeScript, Electron (main/preload/renderer), Vue 3 `<script setup>`, `@pinia/colada` (`useQuery`), Octokit, `@oh-my-github/ui` (shadcn-vue style), Tailwind v4 tokens, `lucide-vue-next`, Vitest.

## Global Constraints

- **Monorepo:** pnpm workspaces. API package `@oh-my-github/api`; client package `@oh-my-github/client`.
- **Code style:** TypeScript **without semicolons**, single quotes, trailing commas in multi-line literals — match the surrounding files exactly (e.g. `main/pulls.ts`, `preload/index.ts`).
- **Renderer write pattern:** the renderer does **not** use `@pinia/colada` `useMutation`. Reads use `useQuery`; writes are plain exported `async function`s calling the bridge; refresh via `<query>.refetch()`.
- **`env.d.ts` mirrors API types by hand** (no import from `@oh-my-github/api`) — new renderer-facing types are re-declared there as global `type` aliases.
- **Do not change `workspace-url.ts`** — `/inbox` already parses to `{ type: 'inbox' }`.
- **Do not change the existing `InboxApi.listNotifications` / `listWorkspaceItems`** — they feed a separate aggregate view; add new methods instead.
- **Styling:** Tailwind semantic tokens only (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `hover:bg-muted/50`, etc.); no scoped CSS.
- **Commands:**
  - API tests: `pnpm --filter @oh-my-github/api exec vitest run <file>`
  - Renderer tests: `pnpm --filter @oh-my-github/client exec vitest run <file>`
  - Typecheck all: `pnpm -r typecheck`
  - Dev app: `pnpm dev`

---

## File Structure

**Created:**
- `packages/api/src/modules/inbox.test.ts` — API unit tests (mapping, html-url, triage)
- `packages/client/src/main/inbox.ts` — IPC handler
- `packages/client/src/renderer/composables/github/use-inbox.ts` — query + write functions
- `packages/client/src/renderer/pages/inbox/inbox-helpers.ts` — pure helpers (target resolution, projection, reason filter)
- `packages/client/src/renderer/pages/inbox/inbox-helpers.test.ts` — helper unit tests
- `packages/client/src/renderer/pages/inbox/components/inbox-notification-item.vue` — one notification row
- `packages/client/src/renderer/pages/inbox/inbox-page.vue` — page entry

**Modified:**
- `packages/api/src/types.ts` — add `GitHubNotification`, `GitHubNotificationReason`, `ListNotificationsOptions`
- `packages/api/src/modules/inbox.ts` — add `notificationHtmlUrl`, export `parseSubjectNumber`, add `listInboxNotifications` + 4 triage methods
- `packages/api/src/index.ts` — add `export * from './modules/inbox'`
- `packages/client/src/main/index.ts` — import + call `registerInboxIpc()`
- `packages/client/src/preload/index.ts` — add `inbox` bridge slice
- `packages/client/src/renderer/env.d.ts` — add `GitHubNotification` type + `inbox` slice typing
- `packages/client/src/renderer/pages/workspace/components/workspace-panel.vue` — add `InboxPage` branch
- `packages/client/src/renderer/i18n/locales/en.json` + `zh.json` — add `workspace.inbox` block

---

## Task 1: API notification model + list method

**Files:**
- Modify: `packages/api/src/types.ts`
- Modify: `packages/api/src/modules/inbox.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/src/modules/inbox.test.ts` (create)

**Interfaces:**
- Produces: `GitHubNotification`, `GitHubNotificationReason`, `ListNotificationsOptions` (in `types.ts`); `InboxApi.listInboxNotifications(options?: ListNotificationsOptions): Promise<GitHubNotification[]>`; exported helpers `notificationHtmlUrl(subjectUrl, repositoryHtmlUrl)` and `parseSubjectNumber(url)`.

- [ ] **Step 1: Add the types to `types.ts`**

Add near `GitHubWorkspaceItem` (after its definition, ~line 954):

```ts
export type GitHubNotificationReason =
  | 'assign'
  | 'author'
  | 'comment'
  | 'ci_activity'
  | 'invitation'
  | 'manual'
  | 'mention'
  | 'review_requested'
  | 'security_alert'
  | 'security_advisory_credit'
  | 'state_change'
  | 'subscribed'
  | 'team_mention'
  | 'approval_requested'
  | (string & {})

export interface GitHubNotification {
  id: string
  unread: boolean
  reason: GitHubNotificationReason
  updatedAt: string
  subjectType: string
  subjectTitle: string
  repositoryFullName: string
  repositoryHtmlUrl: string
  number?: number
  htmlUrl: string
}

export interface ListNotificationsOptions {
  all?: boolean
  participating?: boolean
  limit?: number
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/api/src/modules/inbox.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { GitHubOctokit } from '../transport'
import { InboxApi, notificationHtmlUrl, parseSubjectNumber } from './inbox'

function createApi(notifications: unknown[]) {
  const listNotificationsForAuthenticatedUser = vi.fn()
  const paginate = vi.fn().mockResolvedValue(notifications)
  const api = new InboxApi({
    paginate,
    rest: {
      activity: { listNotificationsForAuthenticatedUser },
    },
  } as unknown as GitHubOctokit)

  return { api, paginate, listNotificationsForAuthenticatedUser }
}

const pullRequestNotification = {
  id: '42',
  unread: true,
  reason: 'review_requested',
  updated_at: '2026-06-30T10:00:00Z',
  subject: {
    title: 'Add inbox page',
    type: 'PullRequest',
    url: 'https://api.github.com/repos/acme/widgets/pulls/7',
    latest_comment_url: null,
  },
  repository: { full_name: 'acme/widgets', html_url: 'https://github.com/acme/widgets' },
}

describe('notificationHtmlUrl', () => {
  it('maps pull request subject urls to github.com pull links', () => {
    expect(
      notificationHtmlUrl('https://api.github.com/repos/acme/widgets/pulls/7', 'https://github.com/acme/widgets'),
    ).toBe('https://github.com/acme/widgets/pull/7')
  })

  it('keeps issue subject urls as issues', () => {
    expect(
      notificationHtmlUrl('https://api.github.com/repos/acme/widgets/issues/9', 'https://github.com/acme/widgets'),
    ).toBe('https://github.com/acme/widgets/issues/9')
  })

  it('maps commit subject urls to github.com commit links', () => {
    expect(
      notificationHtmlUrl('https://api.github.com/repos/acme/widgets/commits/abc123', 'https://github.com/acme/widgets'),
    ).toBe('https://github.com/acme/widgets/commit/abc123')
  })

  it('falls back to the repository html url for unknown or missing subject urls', () => {
    expect(notificationHtmlUrl(null, 'https://github.com/acme/widgets')).toBe('https://github.com/acme/widgets')
    expect(
      notificationHtmlUrl('https://api.github.com/repos/acme/widgets/releases/5', 'https://github.com/acme/widgets'),
    ).toBe('https://github.com/acme/widgets')
  })
})

describe('parseSubjectNumber', () => {
  it('extracts the number from pull and issue urls', () => {
    expect(parseSubjectNumber('https://api.github.com/repos/acme/widgets/pulls/7')).toBe(7)
    expect(parseSubjectNumber('https://api.github.com/repos/acme/widgets/issues/9')).toBe(9)
  })

  it('returns undefined for non-numbered urls', () => {
    expect(parseSubjectNumber(undefined)).toBeUndefined()
    expect(parseSubjectNumber('https://api.github.com/repos/acme/widgets/commits/abc123')).toBeUndefined()
  })
})

describe('InboxApi.listInboxNotifications', () => {
  it('maps notification threads into GitHubNotification objects', async () => {
    const { api } = createApi([pullRequestNotification])
    const [notification] = await api.listInboxNotifications()

    expect(notification).toEqual({
      id: '42',
      unread: true,
      reason: 'review_requested',
      updatedAt: '2026-06-30T10:00:00Z',
      subjectType: 'PullRequest',
      subjectTitle: 'Add inbox page',
      repositoryFullName: 'acme/widgets',
      repositoryHtmlUrl: 'https://github.com/acme/widgets',
      number: 7,
      htmlUrl: 'https://github.com/acme/widgets/pull/7',
    })
  })

  it('passes all and participating options through to paginate', async () => {
    const { api, paginate, listNotificationsForAuthenticatedUser } = createApi([])
    await api.listInboxNotifications({ all: true, participating: true, limit: 10 })

    expect(paginate).toHaveBeenCalledWith(listNotificationsForAuthenticatedUser, {
      all: true,
      participating: true,
      per_page: 10,
    })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @oh-my-github/api exec vitest run src/modules/inbox.test.ts`
Expected: FAIL — `notificationHtmlUrl` / `listInboxNotifications` are not exported.

- [ ] **Step 4: Implement in `inbox.ts`**

Update the imports at the top of `packages/api/src/modules/inbox.ts`:

```ts
import type { GitHubOctokit } from '../transport'
import type {
  GitHubItemKind,
  GitHubItemState,
  GitHubNotification,
  GitHubWorkspaceItem,
  ListNotificationsOptions,
  ListWorkspaceItemsOptions,
} from '../types'
```

Add the new method inside the `InboxApi` class (after the existing `listNotifications` method, before `listPullRequests`):

```ts
  async listInboxNotifications(options: ListNotificationsOptions = {}): Promise<GitHubNotification[]> {
    const limit = options.limit ?? 50
    const notifications = await this.octokit.paginate(
      this.octokit.rest.activity.listNotificationsForAuthenticatedUser,
      {
        all: options.all ?? false,
        participating: options.participating ?? false,
        per_page: Math.min(limit, 50),
      },
    )

    return notifications.slice(0, limit).map((notification) => ({
      id: notification.id,
      unread: notification.unread,
      reason: notification.reason,
      updatedAt: notification.updated_at,
      subjectType: notification.subject.type,
      subjectTitle: notification.subject.title,
      repositoryFullName: notification.repository.full_name,
      repositoryHtmlUrl: notification.repository.html_url,
      number: parseSubjectNumber(notification.subject.url),
      htmlUrl: notificationHtmlUrl(notification.subject.url, notification.repository.html_url),
    }))
  }
```

Change the existing private `parseSubjectNumber` at the bottom of the file to an exported function, and add `notificationHtmlUrl` next to it:

```ts
export function parseSubjectNumber(url: string | undefined | null): number | undefined {
  const match = url?.match(/\/(?:issues|pulls)\/(\d+)$/)
  return match ? Number(match[1]) : undefined
}

export function notificationHtmlUrl(
  subjectUrl: string | null | undefined,
  repositoryHtmlUrl: string,
): string {
  if (!subjectUrl) {
    return repositoryHtmlUrl
  }

  const match = subjectUrl.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/)
  if (!match) {
    return repositoryHtmlUrl
  }

  const [, owner, repo, segment, rest] = match
  const mapped = segment === 'pulls' ? 'pull' : segment === 'commits' ? 'commit' : segment
  if (mapped !== 'pull' && mapped !== 'commit' && mapped !== 'issues') {
    return repositoryHtmlUrl
  }

  return `https://github.com/${owner}/${repo}/${mapped}/${rest}`
}
```

(The existing private `parseSubjectNumber` used by the old `listNotifications` now resolves to this exported one — remove the old duplicate definition so there is exactly one.)

- [ ] **Step 5: Add the barrel export**

In `packages/api/src/index.ts`, add this line in alphabetical position (after `export * from './modules/auth'`):

```ts
export * from './modules/inbox'
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @oh-my-github/api exec vitest run src/modules/inbox.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @oh-my-github/api exec tsc -p tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/types.ts packages/api/src/modules/inbox.ts packages/api/src/modules/inbox.test.ts packages/api/src/index.ts
git commit -m "feat(api): add GitHubNotification model and listInboxNotifications"
```

---

## Task 2: API triage methods

**Files:**
- Modify: `packages/api/src/modules/inbox.ts`
- Test: `packages/api/src/modules/inbox.test.ts`

**Interfaces:**
- Consumes: `InboxApi` (Task 1).
- Produces: `InboxApi.markThreadAsRead(threadId: string): Promise<void>`, `markAllAsRead(lastReadAt?: string): Promise<void>`, `markThreadAsDone(threadId: string): Promise<void>`, `unsubscribe(threadId: string): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Append to `packages/api/src/modules/inbox.test.ts`:

```ts
describe('InboxApi triage', () => {
  function createTriageApi() {
    const markThreadAsRead = vi.fn().mockResolvedValue({ data: {} })
    const markNotificationsAsRead = vi.fn().mockResolvedValue({ data: {} })
    const markThreadAsDone = vi.fn().mockResolvedValue({ data: {} })
    const setThreadSubscription = vi.fn().mockResolvedValue({ data: {} })
    const api = new InboxApi({
      rest: {
        activity: {
          markThreadAsRead,
          markNotificationsAsRead,
          markThreadAsDone,
          setThreadSubscription,
        },
      },
    } as unknown as GitHubOctokit)

    return { api, markThreadAsRead, markNotificationsAsRead, markThreadAsDone, setThreadSubscription }
  }

  it('marks a single thread as read with a numeric thread id', async () => {
    const { api, markThreadAsRead } = createTriageApi()
    await api.markThreadAsRead('42')
    expect(markThreadAsRead).toHaveBeenCalledWith({ thread_id: 42 })
  })

  it('marks all notifications as read', async () => {
    const { api, markNotificationsAsRead } = createTriageApi()
    await api.markAllAsRead()
    expect(markNotificationsAsRead).toHaveBeenCalledWith({})
  })

  it('marks a thread as done', async () => {
    const { api, markThreadAsDone } = createTriageApi()
    await api.markThreadAsDone('42')
    expect(markThreadAsDone).toHaveBeenCalledWith({ thread_id: 42 })
  })

  it('unsubscribes by ignoring the thread subscription', async () => {
    const { api, setThreadSubscription } = createTriageApi()
    await api.unsubscribe('42')
    expect(setThreadSubscription).toHaveBeenCalledWith({ thread_id: 42, ignored: true })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @oh-my-github/api exec vitest run src/modules/inbox.test.ts`
Expected: FAIL — triage methods are not defined.

- [ ] **Step 3: Implement the triage methods**

Add inside the `InboxApi` class (after `listInboxNotifications`):

```ts
  async markThreadAsRead(threadId: string): Promise<void> {
    await this.octokit.rest.activity.markThreadAsRead({ thread_id: Number(threadId) })
  }

  async markAllAsRead(lastReadAt?: string): Promise<void> {
    await this.octokit.rest.activity.markNotificationsAsRead(
      lastReadAt ? { last_read_at: lastReadAt } : {},
    )
  }

  async markThreadAsDone(threadId: string): Promise<void> {
    await this.octokit.rest.activity.markThreadAsDone({ thread_id: Number(threadId) })
  }

  async unsubscribe(threadId: string): Promise<void> {
    await this.octokit.rest.activity.setThreadSubscription({ thread_id: Number(threadId), ignored: true })
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @oh-my-github/api exec vitest run src/modules/inbox.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @oh-my-github/api exec tsc -p tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/modules/inbox.ts packages/api/src/modules/inbox.test.ts
git commit -m "feat(api): add inbox triage methods (read/done/unsubscribe)"
```

---

## Task 3: Main-process IPC handler

**Files:**
- Create: `packages/client/src/main/inbox.ts`
- Modify: `packages/client/src/main/index.ts`

**Interfaces:**
- Consumes: `createGitHubApi(...).inbox.listInboxNotifications/markThreadAsRead/markAllAsRead/markThreadAsDone/unsubscribe` (Tasks 1-2); `ListNotificationsOptions` from `@oh-my-github/api`.
- Produces: IPC channels `inbox:list-notifications`, `inbox:mark-thread-read`, `inbox:mark-all-read`, `inbox:mark-thread-done`, `inbox:unsubscribe`; exported `registerInboxIpc(): void`.

- [ ] **Step 1: Create `packages/client/src/main/inbox.ts`**

```ts
import { createGitHubApi, type ListNotificationsOptions } from '@oh-my-github/api'
import { ipcMain } from 'electron'
import { getAuthenticatedAccessToken } from './auth'
import { resolveGitHubProxyUrl } from './proxy'

export function registerInboxIpc(): void {
  ipcMain.handle('inbox:list-notifications', (_event, options?: ListNotificationsOptions) =>
    listNotifications(options),
  )
  ipcMain.handle('inbox:mark-thread-read', (_event, threadId: string) => markThreadAsRead(threadId))
  ipcMain.handle('inbox:mark-all-read', () => markAllAsRead())
  ipcMain.handle('inbox:mark-thread-done', (_event, threadId: string) => markThreadAsDone(threadId))
  ipcMain.handle('inbox:unsubscribe', (_event, threadId: string) => unsubscribe(threadId))
}

async function listNotifications(options?: ListNotificationsOptions) {
  const api = await createAuthenticatedGitHubApi()
  return api.inbox.listInboxNotifications(options ?? {})
}

async function markThreadAsRead(threadId: string) {
  const api = await createAuthenticatedGitHubApi()
  await api.inbox.markThreadAsRead(threadId)
}

async function markAllAsRead() {
  const api = await createAuthenticatedGitHubApi()
  await api.inbox.markAllAsRead()
}

async function markThreadAsDone(threadId: string) {
  const api = await createAuthenticatedGitHubApi()
  await api.inbox.markThreadAsDone(threadId)
}

async function unsubscribe(threadId: string) {
  const api = await createAuthenticatedGitHubApi()
  await api.inbox.unsubscribe(threadId)
}

async function createAuthenticatedGitHubApi() {
  return createGitHubApi({
    token: getAuthenticatedAccessToken(),
    proxyUrl: await resolveGitHubProxyUrl(),
  })
}
```

- [ ] **Step 2: Register the handler in `main/index.ts`**

Add the import alongside the other `register*Ipc` imports (after `import { registerConfigIpc } from './config'`):

```ts
import { registerInboxIpc } from './inbox'
```

Add the call in the `app.whenReady().then(...)` block, right after `registerConfigIpc()`:

```ts
  registerInboxIpc()
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @oh-my-github/client exec vue-tsc -p tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/main/inbox.ts packages/client/src/main/index.ts
git commit -m "feat(main): add inbox IPC handlers"
```

---

## Task 4: Preload bridge + renderer types

**Files:**
- Modify: `packages/client/src/preload/index.ts`
- Modify: `packages/client/src/renderer/env.d.ts`

**Interfaces:**
- Consumes: IPC channels from Task 3.
- Produces: `window.ohMyGithub.inbox.{ listNotifications, markThreadAsRead, markAllAsRead, markThreadAsDone, unsubscribe }`; global renderer type `GitHubNotification`.

- [ ] **Step 1: Add the `inbox` slice to `preload/index.ts`**

Inside the `const api = { ... }` literal, add a sibling slice (place it next to the `pulls` slice):

```ts
  inbox: {
    listNotifications: (options?: { all?: boolean, participating?: boolean, limit?: number }) =>
      ipcRenderer.invoke('inbox:list-notifications', options),
    markThreadAsRead: (threadId: string) => ipcRenderer.invoke('inbox:mark-thread-read', threadId),
    markAllAsRead: () => ipcRenderer.invoke('inbox:mark-all-read'),
    markThreadAsDone: (threadId: string) => ipcRenderer.invoke('inbox:mark-thread-done', threadId),
    unsubscribe: (threadId: string) => ipcRenderer.invoke('inbox:unsubscribe', threadId),
  },
```

- [ ] **Step 2: Add the `GitHubNotification` type to `env.d.ts`**

Near the other global `type Github*` declarations (e.g. alongside `type GitHubWorkspaceItem` if present, otherwise near `type GitHubPullRequest`), add:

```ts
type GitHubNotification = {
  id: string
  unread: boolean
  reason: string
  updatedAt: string
  subjectType: string
  subjectTitle: string
  repositoryFullName: string
  repositoryHtmlUrl: string
  number?: number
  htmlUrl: string
}
```

- [ ] **Step 3: Add the `inbox` slice typing to the `ohMyGithub` interface in `env.d.ts`**

Inside `interface Window { ohMyGithub: { ... } }`, add as a sibling of the `pulls` slice:

```ts
    inbox: {
      listNotifications: (options?: { all?: boolean, participating?: boolean, limit?: number }) => Promise<GitHubNotification[]>
      markThreadAsRead: (threadId: string) => Promise<void>
      markAllAsRead: () => Promise<void>
      markThreadAsDone: (threadId: string) => Promise<void>
      unsubscribe: (threadId: string) => Promise<void>
    }
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @oh-my-github/client exec vue-tsc -p tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/preload/index.ts packages/client/src/renderer/env.d.ts
git commit -m "feat(preload): expose inbox bridge and GitHubNotification type"
```

---

## Task 5: Renderer pure helpers

**Files:**
- Create: `packages/client/src/renderer/pages/inbox/inbox-helpers.ts`
- Test: `packages/client/src/renderer/pages/inbox/inbox-helpers.test.ts`

**Interfaces:**
- Consumes: `createReferenceWorkspaceUrl(owner, repo, kind, number)` from `../../components/github/github-reference` (`kind: 'issue' | 'pull-request'`); global `GitHubNotification`.
- Produces: `resolveNotificationTarget(n): NotificationTarget`; `projectNotifications(list, overlay): GitHubNotification[]`; `matchesReasonFilter(reason, filter): boolean`; `REASON_FILTER_KEYS`; types `NotificationTarget`, `NotificationOverlay`, `ReasonFilterKey`.

- [ ] **Step 1: Write the failing test**

Create `packages/client/src/renderer/pages/inbox/inbox-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { matchesReasonFilter, projectNotifications, resolveNotificationTarget } from './inbox-helpers'

function notification(overrides: Partial<GitHubNotification> = {}): GitHubNotification {
  return {
    id: '1',
    unread: true,
    reason: 'mention',
    updatedAt: '2026-06-30T10:00:00Z',
    subjectType: 'PullRequest',
    subjectTitle: 'Title',
    repositoryFullName: 'acme/widgets',
    repositoryHtmlUrl: 'https://github.com/acme/widgets',
    number: 7,
    htmlUrl: 'https://github.com/acme/widgets/pull/7',
    ...overrides,
  }
}

describe('resolveNotificationTarget', () => {
  it('routes pull requests to an internal workspace url', () => {
    expect(resolveNotificationTarget(notification())).toEqual({
      kind: 'internal',
      url: '/acme/widgets/pull/7',
    })
  })

  it('routes issues to an internal workspace url', () => {
    expect(resolveNotificationTarget(notification({ subjectType: 'Issue', number: 9 }))).toEqual({
      kind: 'internal',
      url: '/acme/widgets/issues/9',
    })
  })

  it('routes other subject types to the external html url', () => {
    const target = resolveNotificationTarget(
      notification({ subjectType: 'Commit', number: undefined, htmlUrl: 'https://github.com/acme/widgets/commit/abc' }),
    )
    expect(target).toEqual({ kind: 'external', url: 'https://github.com/acme/widgets/commit/abc' })
  })

  it('falls back to external when a pull request has no number', () => {
    const target = resolveNotificationTarget(notification({ number: undefined }))
    expect(target.kind).toBe('external')
  })
})

describe('projectNotifications', () => {
  it('hides removed notifications and marks read ones', () => {
    const list = [notification({ id: '1' }), notification({ id: '2' }), notification({ id: '3' })]
    const result = projectNotifications(list, {
      readIds: new Set(['2']),
      removedIds: new Set(['3']),
    })

    expect(result.map((n) => n.id)).toEqual(['1', '2'])
    expect(result.find((n) => n.id === '2')?.unread).toBe(false)
    expect(result.find((n) => n.id === '1')?.unread).toBe(true)
  })
})

describe('matchesReasonFilter', () => {
  it('matches every reason when no filter is set', () => {
    expect(matchesReasonFilter('ci_activity', null)).toBe(true)
  })

  it('matches assigned, review-requested and mentioned reasons', () => {
    expect(matchesReasonFilter('assign', 'assigned')).toBe(true)
    expect(matchesReasonFilter('review_requested', 'review-requested')).toBe(true)
    expect(matchesReasonFilter('team_mention', 'mentioned')).toBe(true)
    expect(matchesReasonFilter('mention', 'mentioned')).toBe(true)
  })

  it('rejects reasons that do not belong to the filter', () => {
    expect(matchesReasonFilter('ci_activity', 'assigned')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @oh-my-github/client exec vitest run src/renderer/pages/inbox/inbox-helpers.test.ts`
Expected: FAIL — `./inbox-helpers` does not exist.

- [ ] **Step 3: Implement `inbox-helpers.ts`**

```ts
import { createReferenceWorkspaceUrl } from '../../components/github/github-reference'

export type NotificationTarget =
  | { kind: 'internal', url: string }
  | { kind: 'external', url: string }

export function resolveNotificationTarget(notification: GitHubNotification): NotificationTarget {
  const [owner, repo] = notification.repositoryFullName.split('/')

  if (owner && repo && typeof notification.number === 'number') {
    if (notification.subjectType === 'PullRequest') {
      return { kind: 'internal', url: createReferenceWorkspaceUrl(owner, repo, 'pull-request', notification.number) }
    }

    if (notification.subjectType === 'Issue') {
      return { kind: 'internal', url: createReferenceWorkspaceUrl(owner, repo, 'issue', notification.number) }
    }
  }

  return { kind: 'external', url: notification.htmlUrl }
}

export interface NotificationOverlay {
  readIds: Set<string>
  removedIds: Set<string>
}

export function projectNotifications(
  notifications: GitHubNotification[],
  overlay: NotificationOverlay,
): GitHubNotification[] {
  return notifications
    .filter((notification) => !overlay.removedIds.has(notification.id))
    .map((notification) =>
      overlay.readIds.has(notification.id) ? { ...notification, unread: false } : notification,
    )
}

export type ReasonFilterKey = 'assigned' | 'participating' | 'review-requested' | 'mentioned'

export const REASON_FILTER_KEYS: ReasonFilterKey[] = [
  'assigned',
  'participating',
  'review-requested',
  'mentioned',
]

const REASON_FILTER_MATCHERS: Record<ReasonFilterKey, (reason: string) => boolean> = {
  'assigned': (reason) => reason === 'assign',
  'review-requested': (reason) => reason === 'review_requested',
  'mentioned': (reason) => reason === 'mention' || reason === 'team_mention',
  'participating': (reason) => ['comment', 'author', 'manual', 'state_change', 'mention'].includes(reason),
}

export function matchesReasonFilter(reason: string, filter: ReasonFilterKey | null): boolean {
  if (!filter) {
    return true
  }

  return REASON_FILTER_MATCHERS[filter](reason)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @oh-my-github/client exec vitest run src/renderer/pages/inbox/inbox-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/renderer/pages/inbox/inbox-helpers.ts packages/client/src/renderer/pages/inbox/inbox-helpers.test.ts
git commit -m "feat(inbox): add notification target/projection/filter helpers"
```

---

## Task 6: Renderer data composable

**Files:**
- Create: `packages/client/src/renderer/composables/github/use-inbox.ts`

**Interfaces:**
- Consumes: `window.ohMyGithub.inbox.*` (Task 4).
- Produces: `useInboxNotificationsQuery(all: MaybeRefOrGetter<boolean>)`; `markNotificationRead(threadId)`, `markAllNotificationsRead()`, `markNotificationDone(threadId)`, `unsubscribeNotification(threadId)` (all `Promise<void>`).

- [ ] **Step 1: Create `use-inbox.ts`** (mirrors `use-pull-requests.ts` structure)

```ts
import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useQuery } from '@pinia/colada'

function requireInboxBridge() {
  if (!window.ohMyGithub?.inbox) {
    throw new Error('GitHub inbox bridge is unavailable')
  }

  return window.ohMyGithub.inbox
}

export function useInboxNotificationsQuery(all: MaybeRefOrGetter<boolean>) {
  return useQuery<GitHubNotification[]>({
    key: () => ['github', 'notifications', toValue(all)],
    query: async () => requireInboxBridge().listNotifications({ all: toValue(all) }),
  })
}

export async function markNotificationRead(threadId: string): Promise<void> {
  await requireInboxBridge().markThreadAsRead(threadId)
}

export async function markAllNotificationsRead(): Promise<void> {
  await requireInboxBridge().markAllAsRead()
}

export async function markNotificationDone(threadId: string): Promise<void> {
  await requireInboxBridge().markThreadAsDone(threadId)
}

export async function unsubscribeNotification(threadId: string): Promise<void> {
  await requireInboxBridge().unsubscribe(threadId)
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @oh-my-github/client exec vue-tsc -p tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/renderer/composables/github/use-inbox.ts
git commit -m "feat(inbox): add use-inbox composable"
```

---

## Task 7: i18n copy

**Files:**
- Modify: `packages/client/src/renderer/i18n/locales/en.json`
- Modify: `packages/client/src/renderer/i18n/locales/zh.json`

**Interfaces:**
- Produces: `workspace.inbox.*` keys consumed by the page/item components in Tasks 8-9.

- [ ] **Step 1: Add the `inbox` block to `en.json`**

Inside the top-level `"workspace": {` object, add `"inbox"` as the first key (immediately after `"workspace": {`), keeping JSON valid (note the trailing comma):

```json
    "inbox": {
      "title": "Inbox",
      "filters": {
        "all": "All",
        "unread": "Unread",
        "assigned": "Assigned",
        "participating": "Participating",
        "review-requested": "Review requested",
        "mentioned": "Mentioned"
      },
      "actions": {
        "markAllRead": "Mark all as read",
        "refresh": "Refresh",
        "markRead": "Mark as read",
        "done": "Done",
        "unsubscribe": "Unsubscribe"
      },
      "reasons": {
        "assign": "Assigned",
        "author": "Author",
        "comment": "Comment",
        "ci_activity": "CI activity",
        "invitation": "Invitation",
        "manual": "Subscribed",
        "mention": "Mentioned",
        "review_requested": "Review requested",
        "security_alert": "Security alert",
        "security_advisory_credit": "Security advisory",
        "state_change": "State change",
        "subscribed": "Subscribed",
        "team_mention": "Team mentioned",
        "approval_requested": "Approval requested"
      },
      "empty": {
        "title": "You're all caught up",
        "description": "No notifications to show."
      },
      "error": {
        "title": "Couldn't load notifications",
        "retry": "Try again"
      },
      "toast": {
        "actionFailed": "Something went wrong. Please try again."
      }
    },
```

- [ ] **Step 2: Add the matching `inbox` block to `zh.json`**

Same location and structure, translated:

```json
    "inbox": {
      "title": "收件箱",
      "filters": {
        "all": "全部",
        "unread": "未读",
        "assigned": "指派给我",
        "participating": "参与的",
        "review-requested": "请求审查",
        "mentioned": "提及我"
      },
      "actions": {
        "markAllRead": "全部标为已读",
        "refresh": "刷新",
        "markRead": "标为已读",
        "done": "完成",
        "unsubscribe": "取消订阅"
      },
      "reasons": {
        "assign": "指派",
        "author": "作者",
        "comment": "评论",
        "ci_activity": "CI 活动",
        "invitation": "邀请",
        "manual": "已订阅",
        "mention": "提及",
        "review_requested": "请求审查",
        "security_alert": "安全告警",
        "security_advisory_credit": "安全公告",
        "state_change": "状态变更",
        "subscribed": "已订阅",
        "team_mention": "团队提及",
        "approval_requested": "请求批准"
      },
      "empty": {
        "title": "已全部处理完毕",
        "description": "暂无通知。"
      },
      "error": {
        "title": "无法加载通知",
        "retry": "重试"
      },
      "toast": {
        "actionFailed": "操作失败,请重试。"
      }
    },
```

- [ ] **Step 3: Validate JSON**

Run: `pnpm --filter @oh-my-github/client exec vue-tsc -p tsconfig.json --noEmit`
Also confirm both files parse: `node -e "require('./packages/client/src/renderer/i18n/locales/en.json'); require('./packages/client/src/renderer/i18n/locales/zh.json'); console.log('ok')"`
Expected: `ok` and no typecheck errors.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/renderer/i18n/locales/en.json packages/client/src/renderer/i18n/locales/zh.json
git commit -m "feat(inbox): add inbox i18n copy"
```

---

## Task 8: Notification row component

**Files:**
- Create: `packages/client/src/renderer/pages/inbox/components/inbox-notification-item.vue`

**Interfaces:**
- Consumes: global `GitHubNotification`; `formatConversationDate` from `../../../components/conversation/format`; `Badge` from `@oh-my-github/ui`; icons from `lucide-vue-next`.
- Produces: a component with prop `notification: GitHubNotification` and emits `open`, `mark-read`, `done`, `unsubscribe` (each carrying the notification).

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge, Button, Tooltip, TooltipContent, TooltipTrigger } from '@oh-my-github/ui'
import {
  BellOff,
  Check,
  CircleDot,
  GitCommit,
  GitPullRequest,
  MessagesSquare,
  PlayCircle,
  Tag,
} from 'lucide-vue-next'
import { formatConversationDate } from '../../../components/conversation/format'

const props = defineProps<{
  notification: GitHubNotification
}>()

const emit = defineEmits<{
  open: [notification: GitHubNotification]
  'mark-read': [notification: GitHubNotification]
  done: [notification: GitHubNotification]
  unsubscribe: [notification: GitHubNotification]
}>()

const { t } = useI18n()

const iconComponent = computed(() => {
  switch (props.notification.subjectType) {
    case 'PullRequest':
      return GitPullRequest
    case 'Issue':
      return CircleDot
    case 'Commit':
      return GitCommit
    case 'Release':
      return Tag
    case 'Discussion':
      return MessagesSquare
    case 'CheckSuite':
    case 'WorkflowRun':
      return PlayCircle
    default:
      return CircleDot
  }
})

const reasonLabel = computed(() => {
  const key = `workspace.inbox.reasons.${props.notification.reason}`
  const label = t(key)
  return label === key ? props.notification.reason : label
})

const timestamp = computed(() => formatConversationDate(props.notification.updatedAt))
</script>

<template>
  <div
    class="group flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50"
    role="button"
    tabindex="0"
    @click="emit('open', notification)"
    @keydown.enter.prevent="emit('open', notification)"
  >
    <span
      class="size-2 shrink-0 rounded-full"
      :class="notification.unread ? 'bg-info' : 'bg-transparent'"
    />

    <component
      :is="iconComponent"
      class="size-4 shrink-0 text-muted-foreground"
    />

    <div class="grid min-w-0 flex-1 gap-0.5">
      <div class="flex min-w-0 items-center gap-2">
        <span class="truncate text-caption text-muted-foreground">{{ notification.repositoryFullName }}</span>
      </div>
      <span
        class="truncate text-label text-foreground"
        :class="notification.unread ? 'font-semibold' : 'font-normal'"
      >
        {{ notification.subjectTitle }}
      </span>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <Badge variant="secondary">{{ reasonLabel }}</Badge>
      <span
        v-if="timestamp"
        class="text-caption text-muted-foreground"
      >{{ timestamp }}</span>
    </div>

    <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            v-if="notification.unread"
            variant="ghost"
            size="icon"
            @click.stop="emit('mark-read', notification)"
          >
            <Check class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('workspace.inbox.actions.markRead') }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            @click.stop="emit('done', notification)"
          >
            <CircleDot class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('workspace.inbox.actions.done') }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            @click.stop="emit('unsubscribe', notification)"
          >
            <BellOff class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('workspace.inbox.actions.unsubscribe') }}</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @oh-my-github/client exec vue-tsc -p tsconfig.json --noEmit`
Expected: no errors. (If `Button` does not accept `size="icon"`/`variant="ghost"`, open `packages/ui/src/components/button/index.ts` and use the nearest existing variant/size values.)

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/renderer/pages/inbox/components/inbox-notification-item.vue
git commit -m "feat(inbox): add notification row component"
```

---

## Task 9: Inbox page + workspace wiring

**Files:**
- Create: `packages/client/src/renderer/pages/inbox/inbox-page.vue`
- Modify: `packages/client/src/renderer/pages/workspace/components/workspace-panel.vue`

**Interfaces:**
- Consumes: `useInboxNotificationsQuery`, `markNotificationRead`, `markAllNotificationsRead`, `markNotificationDone`, `unsubscribeNotification` (Task 6); `resolveNotificationTarget`, `projectNotifications`, `matchesReasonFilter`, `REASON_FILTER_KEYS` (Task 5); `InboxNotificationItem` (Task 8); `useToast` (`../../composables/use-toast`); `WorkspaceTab` type.
- Produces: `InboxPage` rendered for `tab.type === 'inbox'`.

- [ ] **Step 1: Create `inbox-page.vue`**

```vue
<script setup lang="ts">
import type { WorkspaceTab } from '../workspace/types'
import type { ReasonFilterKey } from './inbox-helpers'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Badge, Button, Empty, EmptyDescription, EmptyHeader, EmptyTitle, ScrollArea, Skeleton } from '@oh-my-github/ui'
import { Inbox as InboxIcon } from 'lucide-vue-next'
import {
  markAllNotificationsRead,
  markNotificationDone,
  markNotificationRead,
  unsubscribeNotification,
  useInboxNotificationsQuery,
} from '../../composables/github/use-inbox'
import { useToast } from '../../composables/use-toast'
import {
  REASON_FILTER_KEYS,
  matchesReasonFilter,
  projectNotifications,
  resolveNotificationTarget,
} from './inbox-helpers'
import InboxNotificationItem from './components/inbox-notification-item.vue'

defineProps<{
  tab: WorkspaceTab
}>()

const { t } = useI18n()
const router = useRouter()
const { error: toastError } = useToast()

const showAll = ref(false)
const reasonFilter = ref<ReasonFilterKey | null>(null)

const readIds = reactive(new Set<string>())
const removedIds = reactive(new Set<string>())

const notificationsQuery = useInboxNotificationsQuery(showAll)
const isLoading = computed(() => notificationsQuery.isLoading.value)
const hasError = computed(() => Boolean(notificationsQuery.error.value))

const notifications = computed(() => {
  const list = projectNotifications(notificationsQuery.data.value ?? [], { readIds, removedIds })
  return list.filter((notification) => matchesReasonFilter(notification.reason, reasonFilter.value))
})

function setShowAll(value: boolean): void {
  showAll.value = value
}

function toggleReasonFilter(key: ReasonFilterKey): void {
  reasonFilter.value = reasonFilter.value === key ? null : key
}

function refresh(): void {
  void notificationsQuery.refetch()
}

async function runTriage(action: () => Promise<void>, rollback: () => void): Promise<void> {
  try {
    await action()
  } catch {
    rollback()
    toastError(t('workspace.inbox.toast.actionFailed'))
  }
}

function openNotification(notification: GitHubNotification): void {
  if (notification.unread) {
    readIds.add(notification.id)
    void runTriage(
      () => markNotificationRead(notification.id),
      () => readIds.delete(notification.id),
    )
  }

  const target = resolveNotificationTarget(notification)
  if (target.kind === 'internal') {
    void router.push(target.url)
  } else {
    void window.ohMyGithub?.links?.openGitHubUrl?.(target.url)
  }
}

function markRead(notification: GitHubNotification): void {
  readIds.add(notification.id)
  void runTriage(
    () => markNotificationRead(notification.id),
    () => readIds.delete(notification.id),
  )
}

function markDone(notification: GitHubNotification): void {
  removedIds.add(notification.id)
  void runTriage(
    () => markNotificationDone(notification.id),
    () => removedIds.delete(notification.id),
  )
}

function unsubscribe(notification: GitHubNotification): void {
  removedIds.add(notification.id)
  void runTriage(
    () => unsubscribeNotification(notification.id),
    () => removedIds.delete(notification.id),
  )
}

async function markAllRead(): Promise<void> {
  const previous = new Set(readIds)
  for (const notification of notificationsQuery.data.value ?? []) {
    readIds.add(notification.id)
  }
  try {
    await markAllNotificationsRead()
    void notificationsQuery.refetch()
  } catch {
    readIds.clear()
    for (const id of previous) {
      readIds.add(id)
    }
    toastError(t('workspace.inbox.toast.actionFailed'))
  }
}
</script>

<template>
  <section class="flex min-h-full flex-col bg-background">
    <header class="grid gap-3 border-b border-border px-6 py-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="select-none text-heading font-semibold text-foreground">
          {{ t('workspace.inbox.title') }}
        </h1>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            @click="markAllRead"
          >
            {{ t('workspace.inbox.actions.markAllRead') }}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            @click="refresh"
          >
            {{ t('workspace.inbox.actions.refresh') }}
          </Button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          :variant="showAll ? 'ghost' : 'secondary'"
          size="sm"
          @click="setShowAll(false)"
        >
          {{ t('workspace.inbox.filters.unread') }}
        </Button>
        <Button
          :variant="showAll ? 'secondary' : 'ghost'"
          size="sm"
          @click="setShowAll(true)"
        >
          {{ t('workspace.inbox.filters.all') }}
        </Button>

        <span class="mx-1 h-4 w-px bg-border" />

        <Badge
          v-for="key in REASON_FILTER_KEYS"
          :key="key"
          :variant="reasonFilter === key ? 'info' : 'secondary'"
          class="cursor-pointer"
          @click="toggleReasonFilter(key)"
        >
          {{ t(`workspace.inbox.filters.${key}`) }}
        </Badge>
      </div>
    </header>

    <ScrollArea class="flex-1">
      <div
        v-if="isLoading"
        class="grid gap-2 p-4"
      >
        <Skeleton
          v-for="index in 6"
          :key="index"
          class="h-14 w-full rounded-md"
        />
      </div>

      <div
        v-else-if="hasError"
        class="grid place-items-center gap-3 p-10 text-center"
      >
        <p class="text-label text-muted-foreground">{{ t('workspace.inbox.error.title') }}</p>
        <Button
          variant="secondary"
          size="sm"
          @click="refresh"
        >
          {{ t('workspace.inbox.error.retry') }}
        </Button>
      </div>

      <Empty
        v-else-if="notifications.length === 0"
        class="p-10"
      >
        <EmptyHeader>
          <InboxIcon class="size-6 text-muted-foreground" />
          <EmptyTitle>{{ t('workspace.inbox.empty.title') }}</EmptyTitle>
          <EmptyDescription>{{ t('workspace.inbox.empty.description') }}</EmptyDescription>
        </EmptyHeader>
      </Empty>

      <div v-else>
        <InboxNotificationItem
          v-for="notification in notifications"
          :key="notification.id"
          :notification="notification"
          @open="openNotification"
          @mark-read="markRead"
          @done="markDone"
          @unsubscribe="unsubscribe"
        />
      </div>
    </ScrollArea>
  </section>
</template>
```

- [ ] **Step 2: Wire the page into `workspace-panel.vue`**

Add the import to the `<script setup>` block (next to the other page imports):

```ts
import InboxPage from '../../inbox/inbox-page.vue'
```

Add the branch in the template **before** the generic `<section v-else>`:

```html
  <InboxPage
    v-else-if="tab.type === 'inbox'"
    :tab="tab"
  />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @oh-my-github/client exec vue-tsc -p tsconfig.json --noEmit`
Expected: no errors. (If any `@oh-my-github/ui` sub-component like `EmptyHeader`/`EmptyTitle`/`EmptyDescription` or a `Button` `variant`/`size` value does not exist, check the component's `index.ts` under `packages/ui/src/components/` and adjust to the real export/prop values.)

- [ ] **Step 4: Manual verification in the running app**

Run: `pnpm dev`
Verify:
1. Click the top **Inbox** sidebar item → the Inbox page renders (no longer the generic placeholder).
2. Notifications load; loading shows skeletons; an authenticated account with zero notifications shows the Empty state.
3. `Unread` / `All` toggle changes the list.
4. A reason chip filters the list; clicking it again clears the filter.
5. Clicking a PullRequest/Issue notification opens the in-app detail tab and the row becomes read; clicking a Commit/Release/Discussion notification opens the system browser.
6. Row hover actions: Mark read clears the unread dot; Done and Unsubscribe remove the row; `Mark all as read` clears all dots.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/renderer/pages/inbox/inbox-page.vue packages/client/src/renderer/pages/workspace/components/workspace-panel.vue
git commit -m "feat(inbox): add inbox page and wire into workspace panel"
```

---

## Self-Review Notes

- **Spec coverage:** read-only list (Tasks 1,6,8,9) ✓; triage read/all-read/done/unsubscribe (Tasks 2,6,9) ✓; `All/Unread` toggle + reason quick-filters (Tasks 5,9) ✓; internal-vs-external navigation (Tasks 5,9) ✓; dedicated `GitHubNotification` type (Task 1) ✓; API-layer `htmlUrl` conversion (Task 1) ✓; loading/empty/error states (Task 9) ✓; i18n (Task 7) ✓. Out-of-scope items (Saved, Done-browse, custom filters, per-repo rail, bulk select) are intentionally excluded.
- **Type consistency:** `GitHubNotification` fields identical across `types.ts` (Task 1) and `env.d.ts` (Task 4). `createReferenceWorkspaceUrl` kind values `'pull-request' | 'issue'` match Task 5 usage. Composable names (`useInboxNotificationsQuery`, `markNotificationRead`, `markAllNotificationsRead`, `markNotificationDone`, `unsubscribeNotification`) match Task 9 imports. IPC channel names match across Tasks 3 and 4.
- **Known adjustment points:** `@oh-my-github/ui` prop/variant/sub-component names are verified by name but exact `Button` `variant`/`size` enums and `Empty*` sub-exports should be confirmed against `packages/ui/src/components/*/index.ts` during Tasks 8-9 (typecheck will surface mismatches).
