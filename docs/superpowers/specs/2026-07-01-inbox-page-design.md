# Inbox Page Design

**Date:** 2026-07-01
**Status:** Approved

## Goal

Implement the top-level **Inbox** page (the sidebar's topmost item routing to `/inbox`, distinct from the PR/Issue category items). It surfaces the authenticated user's GitHub notifications with read-only browsing plus basic triage.

## Scope (v1)

**In:** read-only notification list + basic triage that the public REST API supports — mark thread read, mark all read, mark done (removes from inbox), unsubscribe. Top bar with `All / Unread` toggle and a row of reason quick-filters. Click routes to the in-app PR/Issue page when possible, otherwise opens the system browser.

**Out (YAGNI):**
- Saved / bookmarked notifications — the public REST API cannot list or set these.
- Browsing the Done archive — the API cannot list done notifications (`all=true` only returns read+unread).
- Custom filters, per-repository left rail, bulk multi-select.
- Reusing `listWorkspaceItems` / `GitHubWorkspaceItem` (unrelated aggregate view).

## Research Summary

**GitHub web inbox** shows: left rail (Inbox / Saved / Done / default filters / up to 15 custom filters); top bar (Unread toggle, group/sort, `is:` / `reason:` / `repo:` / `org:` / `author:` query, bulk select); each row shows type icon, repo name, title, reason label, timestamp, unread dot, participant avatars, and hover actions (Done / Save / Unsubscribe / Mark read).

**Notifications REST API** (`GET /notifications`): each thread has `id`, `unread`, `reason`, `updated_at`, `subject{title,type,url,latest_comment_url}`, `repository{full_name,html_url}`. Query params: `all`, `participating`, `since`, `before`, `per_page` (max 50). Actions: mark thread read (`PATCH`), mark all read (`PUT`), mark done (`DELETE /notifications/threads/{id}`), subscription (`PUT/DELETE`). No public API for Saved or listing Done.

Sources: [Managing notifications](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox), [Inbox filters](https://docs.github.com/en/subscriptions-and-notifications/reference/inbox-filters), [Notifications REST API](https://docs.github.com/en/rest/activity/notifications).

## Codebase Reality (drives the design)

- `/inbox` already parses to `{ type: 'inbox' }` in `workspace-url.ts`; the sidebar already navigates there. **No `workspace-url.ts` change needed** — only a `workspace-panel.vue` branch + a page component are missing.
- `InboxApi.listNotifications()` exists but maps into the lossy `GitHubWorkspaceItem` (crams `reason` into `labels`, drops thread id / subject url). A **dedicated `GitHubNotification` type** replaces this for the inbox path.
- `packages/api/src/index.ts` does **not** export `./modules/inbox` — must add.
- The renderer does **not** use `@pinia/colada` `useMutation` anywhere. Writes are plain exported async functions; reads use `useQuery`; refresh via `refetch()`. Follow that pattern.
- `env.d.ts` re-declares `window.ohMyGithub` types by hand (no import from `@oh-my-github/api`). New types are mirrored there.
- Internal navigation is `router.push(createReferenceWorkspaceUrl(owner, repo, kind, number))` with `kind: 'issue' | 'pull-request'`.
- External open is `window.ohMyGithub.links.openGitHubUrl(url)` — accepts only `https://github.com` hosts, so the API layer must convert `api.github.com` subject URLs to `github.com` html URLs.

## Architecture & Data Flow

```
packages/api   InboxApi (listNotifications + 4 triage) — Octokit rest.activity
     │ IPC channels: inbox:list-notifications / inbox:mark-read /
     │               inbox:mark-all-read / inbox:mark-done / inbox:unsubscribe
main   src/main/inbox.ts  registerInboxIpc()  → createAuthenticatedGitHubApi()
     │ contextBridge
preload  window.ohMyGithub.inbox.{ listNotifications, markThreadAsRead,
     │                             markAllAsRead, markThreadAsDone, unsubscribe }
renderer  composables/github/use-inbox.ts  (useQuery + plain async writes)
     │  + pure helpers: notification target resolver, projection overlay
page  pages/inbox/inbox-page.vue (+ components/) ← new branch in workspace-panel.vue
```

## Data Model (`packages/api/src/types.ts`)

```ts
export type GitHubNotificationReason =
  | 'assign' | 'author' | 'comment' | 'ci_activity' | 'invitation'
  | 'manual' | 'mention' | 'review_requested' | 'security_alert'
  | 'security_advisory_credit' | 'state_change' | 'subscribed'
  | 'team_mention' | 'approval_requested' | (string & {})

export interface GitHubNotification {
  id: string                 // thread id
  unread: boolean
  reason: GitHubNotificationReason
  updatedAt: string
  subjectType: string        // Issue | PullRequest | Commit | Release | Discussion | CheckSuite | ...
  subjectTitle: string
  repositoryFullName: string // owner/repo
  repositoryHtmlUrl: string
  number?: number            // parsed from subject.url for Issue/PullRequest
  htmlUrl: string            // github.com deep link, computed in API layer
}

export interface ListNotificationsOptions {
  all?: boolean
  participating?: boolean
  limit?: number
}
```

`htmlUrl` is derived in the API layer from `subject.url` (`api.github.com/repos/{o}/{r}/{seg}/{rest}` → `github.com/{o}/{r}/{mapped}/{rest}`, mapping `pulls→pull`, `commits→commit`, `issues→issues`); unrecognized shapes fall back to `repositoryHtmlUrl`.

## Triage (API layer, `rest.activity`)

- `markThreadAsRead(threadId)` → `markThreadAsRead({ thread_id })`
- `markAllAsRead(lastReadAt?)` → `markNotificationsAsRead({ last_read_at? })`
- `markThreadAsDone(threadId)` → `markThreadAsDone({ thread_id })` (removes from inbox)
- `unsubscribe(threadId)` → `setThreadSubscription({ thread_id, ignored: true })` (mutes + removes)

Thread ids arrive as strings; the API layer converts with `Number(threadId)`.

## Renderer

- `useInboxNotificationsQuery(all)` — `useQuery`, key `['github','notifications', all]`.
- Plain async writes mirroring the bridge (`markNotificationRead`, `markAllNotificationsRead`, `markNotificationDone`, `unsubscribeNotification`).
- Two pure helpers (unit-tested):
  - `resolveNotificationTarget(n)` → `{ kind: 'internal', url }` for PullRequest/Issue with a number, else `{ kind: 'external', url: n.htmlUrl }`.
  - `projectNotifications(list, { readIds, removedIds })` → applies optimistic overlay (mark read locally, hide done/unsubscribed) so triage feels instant without a full refetch; on write error the overlay entry is rolled back and a `sonner` toast is shown.

## Page UI (`pages/inbox/`)

- **Top bar:** `All / Unread` segmented toggle (drives the `all` query param) · reason quick-filter chips `Assigned / Participating / Review requested / Mentioned` (client-side by `reason`) · `Mark all as read` · refresh.
- **List:** `ScrollArea`, flat, sorted by `updatedAt` desc.
- **Row (`inbox-notification-item.vue`):** unread dot · type icon (lucide by `subjectType`) · repo name + title · reason `Badge` + relative time · hover actions (Done / Mark read / Unsubscribe) with tooltips.
- **States:** `Skeleton` rows while loading; `Empty` ("Inbox zero") when none; error state with retry.

## Click Navigation

```
PullRequest + number → router.push(createReferenceWorkspaceUrl(owner,repo,'pull-request',number))
Issue + number       → router.push(createReferenceWorkspaceUrl(owner,repo,'issue',number))
otherwise            → window.ohMyGithub.links.openGitHubUrl(htmlUrl)
```
Opening a notification also marks it read (GitHub behavior).

## i18n

Extend `workspace` in `renderer/i18n/locales/{en,zh}.json` with an `inbox` block: filter labels, action labels, reason labels, empty/error copy.

## Testing

- `packages/api`: `inbox.test.ts` — mock Octokit (`paginate`, `rest.activity.*`); assert field mapping, `htmlUrl` derivation, `number` parsing, and that each triage method calls the right endpoint with `Number(threadId)`.
- Renderer: unit-test the two pure helpers (`resolveNotificationTarget`, `projectNotifications`) as colocated `*.test.ts`, matching the existing `pull-request-merge-dialog-state.test.ts` style.
