# Sub-project D — Issue Subscribe + Actions Menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the bottom-of-sidebar **Notifications/Subscribe** control and the **actions menu** (Lock conversation, Pin issue, Delete issue, with Transfer flagged optional and Convert-to-discussion documented as out of reach) to the issue detail page, backed by real GitHub writes with confirmation dialogs for destructive actions.

**Architecture:** Expose the data needed to drive the controls (issue GraphQL `nodeId`, `locked`, `viewerSubscription`, `viewerCanUpdate`/`viewerCanDelete`, `isPinned`) by extending `issueDetailQuery` (same plumbing as sub-project B). Each action is a mutation via the established 9-layer recipe (see sub-project C's plan). The menu clones the `DropdownMenu` pattern already in `issue-header.vue`. Destructive actions (Delete, Transfer) open a `Dialog` + `DialogFooter` confirm (no `AlertDialog` exists in `@oh-my-github/ui`). After Delete, navigate away using the app's existing navigation.

**Tech Stack:** GitHub GraphQL + REST (octokit), Electron IPC, Vue 3 `<script setup>`, `@oh-my-github/ui` (DropdownMenu, Dialog, Button), lucide icons.

## Global Constraints

- **Code style:** no semicolons, single quotes, 2-space indent.
- **Mutation recipe:** see `2026-06-30-C-issue-sidebar-editable-fields.md` → "The Mutation Recipe" (9 layers). Mutations are plain composable functions; component awaits then `issueQuery.refetch()`. Methods added to `GitHubClient` must be implemented in `mock.ts`.
- **Raw GraphQL id:** GraphQL mutations (subscribe/pin/delete/transfer) need the issue's **raw global node id**, not the `issue:${id}`-prefixed `GitHubIssueDetail.id`. Task 1 adds `nodeId`.
- **Gate menu items on permissions:** show Delete/Lock only when `viewerCanDelete`/`viewerCanUpdate` is true.
- **Verification:** typecheck both packages; manual check in the dev app (mock mutations succeed). Destructive actions confirmed only after the dialog.
- **Live shared tree:** anchor edits on exact strings. **Depends on A; independent of B/C** (but shares the detail-query extension style with B).

---

### Task 1: Expose issue state/permission data

Extend the detail query + types with the fields the controls need (data-only, like sub-project B).

**Interfaces produced on `GitHubIssueDetail`:**
- `nodeId: string` (raw GraphQL id)
- `locked: boolean`
- `isPinned: boolean`
- `viewerSubscription: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'IGNORED' | null`
- `viewerCanUpdate: boolean`
- `viewerCanDelete: boolean`

- [ ] **Step 1: GraphQL** — in `issueDetailQuery` add to the `Issue { ... }` selection (siblings of `reactionGroups`):
```
    locked
    isPinned
    viewerSubscription
    viewerCanUpdate
    viewerCanDelete
```
(The raw id is already selected as `id` via `...IssueFields`.)

- [ ] **Step 2: node type** — add `locked?: boolean | null`, `isPinned?: boolean | null`, `viewerSubscription?: string | null`, `viewerCanUpdate?: boolean | null`, `viewerCanDelete?: boolean | null` to `GraphQLIssueDetailNode`.

- [ ] **Step 3: api type** — add the six fields to `GitHubIssueDetail` (`types.ts`); `viewerSubscription` typed as the union above.

- [ ] **Step 4: mapper** — in `mapIssueDetailNode`, the existing `id: \`issue:${node.id}\`` stays; add:
```ts
    nodeId: node.id,
    locked: node.locked ?? false,
    isPinned: node.isPinned ?? false,
    viewerSubscription: (node.viewerSubscription as GitHubIssueDetail['viewerSubscription']) ?? null,
    viewerCanUpdate: node.viewerCanUpdate ?? false,
    viewerCanDelete: node.viewerCanDelete ?? false,
```

- [ ] **Step 5: mirror** — add the six fields to the env.d.ts `GitHubIssueDetail` mirror and to renderer `IssueDetail` (`pages/issue/components/types.ts`) with identical names. Add them to the `mock.ts` issue-detail object (`nodeId: 'mock-node', locked: false, isPinned: false, viewerSubscription: null, viewerCanUpdate: true, viewerCanDelete: true`).

- [ ] **Step 6: typecheck both, commit.**

---

### Task 2: Notifications / Subscribe control

REST/GraphQL: GraphQL `updateSubscription(input: { subscribableId, state })` (state `SUBSCRIBED`/`UNSUBSCRIBED`).

- [ ] **Step 1: mutation (recipe)** — `setIssueSubscription(options: { owner; repo; number; subscribableId: string; subscribed: boolean }): Promise<void>`. IssuesApi impl:
```ts
async setIssueSubscription(options: SetIssueSubscriptionOptions): Promise<void> {
  await this.octokit.graphql(
    `mutation($id: ID!, $state: SubscriptionState!) {
       updateSubscription(input: { subscribableId: $id, state: $state }) { clientMutationId }
     }`,
    { id: options.subscribableId, state: options.subscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED' }
  )
}
```
Add `SetIssueSubscriptionOptions` to types.ts (`extends RepositoryOptions { number: number; subscribableId: string; subscribed: boolean }`), the `GitHubClient` method, the client delegate, the mock no-op, the IPC handler `issues:set-subscription`, the preload bridge, the env.d.ts signature, and the composable fn.

- [ ] **Step 2: render** — add a `Notifications` block at the bottom of `issue-sidebar.vue` (after the last section) with a `Subscribe`/`Unsubscribe` `Button` (toggle by `issue.viewerSubscription === 'SUBSCRIBED'`) that calls `setIssueSubscription(... , subscribed: !subscribed)` then emits `refetch`. Add i18n `issue.sidebar.notifications.subscribe`/`unsubscribe`/`title` (en + zh).

- [ ] **Step 3: typecheck, manual check, commit.**

---

### Task 3: Actions menu scaffold

Clone the `issue-header.vue` `DropdownMenu` pattern into the sidebar bottom.

- [ ] **Step 1** — in `issue-sidebar.vue`, import `Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger` from `@oh-my-github/ui` and icons (`Lock`, `Pin`, `Trash2`, `ArrowRightLeft`) from `lucide-vue-next`. Add a menu block at the bottom listing items (handlers stubbed in this task, implemented in Tasks 4-6). Gate each item with `v-if` on the relevant `viewerCan*`/`locked`/`isPinned` flags. Add i18n keys `issue.sidebar.actions.lock`/`unlock`/`pin`/`unpin`/`delete`/`transfer` (en + zh).

- [ ] **Step 2** — typecheck, commit (menu visible, items no-op).

---

### Task 4: Lock / Unlock conversation

REST `issues.lock` / `issues.unlock`.

- [ ] **Step 1: mutation (recipe)** — `setIssueLock(options: { owner; repo; number; locked: boolean }): Promise<void>`:
```ts
async setIssueLock(options: SetIssueLockOptions): Promise<void> {
  if (options.locked) {
    await this.octokit.rest.issues.lock({ owner: options.owner, repo: options.repo, issue_number: options.number })
  } else {
    await this.octokit.rest.issues.unlock({ owner: options.owner, repo: options.repo, issue_number: options.number })
  }
}
```
Full recipe wiring (channel `issues:set-lock`).

- [ ] **Step 2** — wire the Lock/Unlock menu item (label toggles on `issue.locked`) → `setIssueLock({ locked: !issue.locked })` → refetch. Typecheck, manual check, commit.

---

### Task 5: Pin / Unpin

GraphQL `pinIssue` / `unpinIssue`.

- [ ] **Step 1: mutation (recipe)** — `setIssuePinned(options: { owner; repo; number; nodeId: string; pinned: boolean }): Promise<void>`:
```ts
async setIssuePinned(options: SetIssuePinnedOptions): Promise<void> {
  const mutation = options.pinned
    ? `mutation($id: ID!) { pinIssue(input: { issueId: $id }) { clientMutationId } }`
    : `mutation($id: ID!) { unpinIssue(input: { issueId: $id }) { clientMutationId } }`
  await this.octokit.graphql(mutation, { id: options.nodeId })
}
```
Full recipe wiring (channel `issues:set-pinned`).

- [ ] **Step 2** — wire the Pin/Unpin item (toggle on `issue.isPinned`, pass `issue.nodeId`) → refetch. Typecheck, manual check, commit.

---

### Task 6: Delete issue (destructive — confirm dialog + navigate away)

GraphQL `deleteIssue`.

- [ ] **Step 1: mutation (recipe)** — `deleteIssue(options: { owner; repo; number; nodeId: string }): Promise<void>`:
```ts
async deleteIssue(options: DeleteIssueOptions): Promise<void> {
  await this.octokit.graphql(
    `mutation($id: ID!) { deleteIssue(input: { issueId: $id }) { clientMutationId } }`,
    { id: options.nodeId }
  )
}
```
Full recipe wiring (channel `issues:delete`).

- [ ] **Step 2: confirm dialog** — in `issue-sidebar.vue` add a `Dialog` (state `isDeleteDialogOpen`) opened by the Delete menu item. `DialogContent` with `DialogTitle` (i18n `issue.sidebar.actions.deleteConfirmTitle`), `DialogDescription` (warn irreversible), and `DialogFooter` with a Cancel `Button` (variant outline) and a Delete `Button` (variant destructive). The Delete button calls `await deleteIssue(issue.owner, issue.repo, issue.number, issue.nodeId)` then **navigates away** using the app's existing navigation (search how `issue-page.vue`/the workspace tab system closes/opens a view — e.g. closing the current tab or navigating to the repository issues list). Add the navigation as a `emit('deleted')` the page handles, mirroring how the page already handles routing.

- [ ] **Step 3** — typecheck, manual check (dialog opens, cancel closes, confirm deletes in mock + navigates), commit.

---

### Task 7 (OPTIONAL): Transfer issue (destructive — needs target-repo picker)

GraphQL `transferIssue(input: { issueId, repositoryId })` — requires resolving the **target repository's node id**, which means a repo search/picker inside the dialog.

- [ ] **Step 1** — add a `Dialog` with a `SearchableSelect` (or the existing repo search) to pick the destination repo; resolve its node id (GraphQL `repository(owner,name){ id }` or reuse an existing repo-resolution query). Add `transferIssue` mutation (recipe). On confirm → transfer → navigate to the moved issue or close. **This is the most involved action; implement last or defer.**

---

### Task 8 (DEFERRED): Convert to discussion

> There is no stable, simple GitHub API mutation to convert an issue to a discussion equivalent to the web UI flow. **Recommendation: do not implement.** If required later, it needs a repo discussion-category lookup + a non-public/﻿unstable path — document and revisit. For now, omit this menu item (the screenshot's "Convert to discussion" stays out of scope).

---

## Self-Review checklist
- Every mutation method on `GitHubClient` is implemented in `mock.ts`.
- GraphQL mutations receive `issue.nodeId` (raw id), not the prefixed `id`.
- Destructive actions (Delete, Transfer) only execute after the confirm `Dialog`; Delete navigates away afterward.
- Menu items gated on `viewerCanUpdate`/`viewerCanDelete`/`locked`/`isPinned`.
- i18n keys for notifications + actions in both `en.json` and `zh.json`.

## Out of scope
- Read-only sections (Type/Relationships/Projects/Development) → sub-project B.
- Field editing (assignees/labels/milestone/type) → sub-project C.
- Convert to discussion → deferred (Task 8).
