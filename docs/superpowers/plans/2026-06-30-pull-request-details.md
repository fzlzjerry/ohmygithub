# Pull Request Details — Editable Sidebar + Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring the PR detail page to parity with the issue detail page: make the sidebar **Reviewers / Assignees / Labels / Milestone** editable, add a read-only **Projects** section, and add **Subscribe / Lock** actions to the header menu (removing Copy URL).

**Architecture:** Mirror the issue-side implementation that already exists in this repo. PR assignees/labels/milestone are written through the **issues REST endpoint** (PRs are issues) by extending `updatePullRequest`; reviewers use a new `requestPullRequestReviewers` mutation (REST add/remove diff). Subscribe/Lock **reuse** the existing generic `setIssueSubscription` / `setIssueLock` mutations (node-id / issue-number based). Picker options reuse the existing repo-scoped `listRepositoryLabels` / `listRepositoryMilestones` / `listAssignableUsers` queries. Read-only `locked` / `viewerSubscription` / `projects` are added to the PR detail GraphQL → type → mapper → renderer chain.

**Tech Stack:** GitHub GraphQL + REST (octokit), Electron IPC, Vue 3 `<script setup>`, `@oh-my-github/ui` (MultiSelectPicker reuse, DropdownMenu, Dialog), pinia-colada, Vitest (pure mappers only).

## Global Constraints

- **Code style (match surrounding files):** no semicolons, single quotes, 2-space indent.
- **The reference implementation is the issue side** — these files already exist and are the exact template to copy:
  - Editable sidebar fields: `packages/client/src/renderer/pages/issue/components/issue-sidebar.vue` (MultiSelectPicker `#action` slots + `applyIssueUpdate`).
  - Header actions menu: `packages/client/src/renderer/pages/issue/components/issue-header.vue` (Subscribe/Lock DropdownMenuItems + confirm dialog pattern).
  - Mutation chain (9 layers): `setIssueLock` / `setIssueSubscription` across `types.ts` → `modules/issues.ts` → `client.ts` → `mock.ts` → `main/issues.ts` → `preload/index.ts` → `env.d.ts` → `use-issues.ts`.
  - Read-only data plumbing: `mapIssueProjects` in `packages/api/src/modules/issues.ts` + its test `issues.projects.test.ts`.
- **PRs are issues for field writes:** assignees/labels/milestone/lock go through `rest.issues.*` with `issue_number: pr.number`. Title/body/base/state stay on `rest.pulls.update`.
- **No Pin, no Delete for PRs** — GitHub has no PR pin or PR delete. Do not add them.
- **Verification per package:** `pnpm --filter @oh-my-github/api typecheck`, `pnpm --filter @oh-my-github/client typecheck`. Pure mappers get a vitest test (api vitest already configured). Interactive behavior is confirmed manually in the running `electron-vite dev` app.
- **The app runs in dev with concurrent editing — anchor edits on the exact code strings shown, not line numbers.**

## File-Structure Map

| File | Responsibility | Tasks |
|---|---|---|
| `packages/api/src/types.ts` | `GitHubPullRequestDetail` fields; PR option types + `GitHubClient` methods | 1,2,3 |
| `packages/api/src/modules/pulls.ts` | PR detail GraphQL query, node type, mapper; new PR mutation methods | 1,2,3 |
| `packages/api/src/client.ts` | delegate wiring | 2,3 |
| `packages/api/src/mock.ts` | mock impls + mock PR detail fields | 1,2,3 |
| `packages/client/src/main/pulls.ts` | IPC handlers | 2,3 |
| `packages/client/src/preload/index.ts` | `pulls` bridge | 2,3 |
| `packages/client/src/renderer/env.d.ts` | `GitHubPullRequestDetail` mirror + `pulls` window types | 1,2,3 |
| `packages/client/src/renderer/composables/github/use-pull-requests.ts` | renderer mutation wrappers | 2,3 |
| `packages/client/src/renderer/pages/pull-request/components/pull-request-sidebar.vue` | editable pickers + Projects section | 4 |
| `packages/client/src/renderer/pages/pull-request/components/types.ts` | renderer `PullRequestDetail` mirror (it's `= GitHubPullRequestDetail`, so automatic) | 1 |
| `packages/client/src/renderer/pages/pull-request/components/pull-request-header.vue` | actions menu | 5 |
| `packages/client/src/renderer/i18n/locales/{en,zh}.json` | new keys | 4,5 |

---

### Task 1: PR read-only data — `locked`, `viewerSubscription`, `projects`

Add the data the later tasks need (subscribe/lock toggle state + a Projects section). Pure additive plumbing, no mutations.

**Files:** `pulls.ts` (query/node/mapper), `types.ts`, `env.d.ts`, `mock.ts`; Create `packages/api/src/modules/pulls.projects.test.ts`.

**Interfaces produced on `GitHubPullRequestDetail`:**
- `locked: boolean`
- `viewerSubscription: GitHubIssueSubscription | null` (reuses the existing `GitHubIssueSubscription = 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'IGNORED'` type from types.ts)
- `projects: GitHubIssueProjectItem[]` (reuses the existing `GitHubIssueProjectItem = { id; title; url: string | null; fields: { name; value }[] }` type)

- [ ] **Step 1: GraphQL** — in `pulls.ts` `pullRequestDetailQuery`, add inside the `pullRequest(number:)` selection. Anchor on the existing `viewerCanUpdate`/`viewerCanMergeAsAdmin` block (read it first to confirm exact indentation), and append:
```
        viewerCanMergeAsAdmin
        locked
        viewerSubscription
        projectItems(first: 10) {
          nodes {
            id
            project { title url }
            fieldValues(first: 20) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { name } } }
                ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
                ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { name } } }
              }
            }
          }
        }
```
> Note: `PullRequest` has `locked` and `viewerSubscription` (from `Subscribable`) and `projectItems` — all valid. It does NOT have `isPinned` (do not add it).

- [ ] **Step 2: node type** — in `GraphQLPullRequestDetailNode` (`pulls.ts`), append after `viewerCanMergeAsAdmin?: boolean | null`:
```ts
  locked?: boolean | null
  viewerSubscription?: string | null
  projectItems?: {
    nodes?: Array<{
      id: string
      project?: { title: string, url?: string | null } | null
      fieldValues?: {
        nodes?: Array<{
          __typename?: string
          name?: string | null
          text?: string | null
          number?: number | null
          field?: { name?: string | null } | null
        } | null> | null
      } | null
    } | null> | null
  } | null
```

- [ ] **Step 3: api type** — in `types.ts`, add to `GitHubPullRequestDetail` after `viewerCanMergeAsAdmin: boolean`:
```ts
  locked: boolean
  viewerSubscription: GitHubIssueSubscription | null
  projects: GitHubIssueProjectItem[]
```
(`GitHubIssueSubscription` and `GitHubIssueProjectItem` already exist in this file — no new types needed.)

- [ ] **Step 4: Write the failing mapper test**

Create `packages/api/src/modules/pulls.projects.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { mapPullRequestProjects } from './pulls'

describe('mapPullRequestProjects', () => {
  it('maps a project item with a single-select field', () => {
    const result = mapPullRequestProjects({
      projectItems: {
        nodes: [
          {
            id: 'item1',
            project: { title: 'Roadmap', url: 'https://github.com/orgs/x/projects/1' },
            fieldValues: { nodes: [{ __typename: 'ProjectV2ItemFieldSingleSelectValue', name: 'High', field: { name: 'Priority' } }] }
          }
        ]
      }
    })
    expect(result).toEqual([
      { id: 'item1', title: 'Roadmap', url: 'https://github.com/orgs/x/projects/1', fields: [{ name: 'Priority', value: 'High' }] }
    ])
  })

  it('returns empty array when no project items', () => {
    expect(mapPullRequestProjects({})).toEqual([])
  })
})
```

- [ ] **Step 5: Run the test — verify it fails**

Run: `pnpm --filter @oh-my-github/api exec vitest run src/modules/pulls.projects.test.ts`
Expected: FAIL — `mapPullRequestProjects` not exported.

- [ ] **Step 6: mapper + helper** — in `pulls.ts`, add `mapPullRequestProjects` (copy the body of `mapIssueProjects` from `issues.ts` verbatim, retyped for the PR node) and a `normalizePullRequestSubscription` (copy `normalizeIssueSubscription`):
```ts
export function mapPullRequestProjects(
  node: Pick<GraphQLPullRequestDetailNode, 'projectItems'>
): GitHubIssueProjectItem[] {
  const itemNodes = (node.projectItems?.nodes ?? []).filter(
    (item): item is NonNullable<typeof item> => Boolean(item?.project)
  )
  return itemNodes.map((item) => {
    const fieldNodes = (item.fieldValues?.nodes ?? []).filter((f): f is NonNullable<typeof f> => Boolean(f))
    const fields = fieldNodes.flatMap((field) => {
      const name = field.field?.name
      const value = field.name ?? field.text ?? (typeof field.number === 'number' ? String(field.number) : null)
      return name && value ? [{ name, value }] : []
    })
    return { id: item.id, title: item.project?.title ?? '', url: item.project?.url ?? null, fields }
  })
}

function normalizePullRequestSubscription(value: string | null | undefined): GitHubIssueSubscription | null {
  if (value === 'SUBSCRIBED' || value === 'UNSUBSCRIBED' || value === 'IGNORED') return value
  return null
}
```
Import `GitHubIssueProjectItem` and `GitHubIssueSubscription` into the `pulls.ts` type-import block. Then in `mapPullRequestDetailNode`'s returned object, add (after `viewerCanMergeAsAdmin: ...`):
```ts
    locked: node.locked ?? false,
    viewerSubscription: normalizePullRequestSubscription(node.viewerSubscription),
    projects: mapPullRequestProjects(node),
```

- [ ] **Step 7: Run the test — verify it passes**

Run: `pnpm --filter @oh-my-github/api exec vitest run src/modules/pulls.projects.test.ts`
Expected: PASS (2).

- [ ] **Step 8: mock + renderer mirror** — in `mock.ts`, in the mock PR detail object (next to `viewerCanMergeAsAdmin`), add `locked: false,`, `viewerSubscription: null,`, `projects: [],`. In `env.d.ts`, add the three fields to the `GitHubPullRequestDetail` mirror (after `viewerCanMergeAsAdmin: boolean`): `locked: boolean`, `viewerSubscription: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'IGNORED' | null`, `projects: Array<{ id: string, title: string, url: string | null, fields: Array<{ name: string, value: string }> }>`. The renderer `PullRequestDetail` is `= GitHubPullRequestDetail` (alias), so no separate renderer edit is needed.

- [ ] **Step 9: typecheck both + commit**
```bash
pnpm --filter @oh-my-github/api typecheck && pnpm --filter @oh-my-github/client typecheck
git add packages/api/src/modules/pulls.ts packages/api/src/modules/pulls.projects.test.ts \
  packages/api/src/types.ts packages/api/src/mock.ts packages/client/src/renderer/env.d.ts
git commit -m "feat(pr): add locked/viewerSubscription/projects to PR detail"
```

---

### Task 2: Extend `updatePullRequest` for assignees / labels / milestone

PRs are issues, so these route through `rest.issues.update`. Extend the existing `updatePullRequest` payload.

**Files:** `types.ts`, `pulls.ts`, `mock.ts` (no-op already covers it), `main/pulls.ts`, `preload/index.ts`, `env.d.ts`, `use-pull-requests.ts`.

**Interface produced:** `UpdatePullRequestOptions` gains `assignees?: string[]; labels?: string[]; milestone?: number | null`; renderer `updatePullRequest(owner, repo, number, changes)` accepts the same.

- [ ] **Step 1: types.ts** — extend `UpdatePullRequestOptions`:
old:
```ts
export interface UpdatePullRequestOptions extends GetPullRequestDetailOptions {
  title?: string
  body?: string
  state?: 'open' | 'closed'
}
```
new:
```ts
export interface UpdatePullRequestOptions extends GetPullRequestDetailOptions {
  title?: string
  body?: string
  state?: 'open' | 'closed'
  assignees?: string[]
  labels?: string[]
  milestone?: number | null
}
```

- [ ] **Step 2: PullsApi.updatePullRequest** — route the new fields through `rest.issues.update`, keep title/body/state on `rest.pulls.update`. Replace the method body:
```ts
  async updatePullRequest(options: UpdatePullRequestOptions): Promise<void> {
    const hasPullFields = options.title !== undefined || options.body !== undefined || options.state !== undefined
    const hasIssueFields = options.assignees !== undefined || options.labels !== undefined || options.milestone !== undefined

    if (hasPullFields) {
      await this.octokit.rest.pulls.update({
        owner: options.owner,
        repo: options.repo,
        pull_number: options.number,
        ...(options.title !== undefined ? { title: options.title } : {}),
        ...(options.body !== undefined ? { body: options.body } : {}),
        ...(options.state !== undefined ? { state: options.state } : {})
      })
    }

    if (hasIssueFields) {
      await this.octokit.rest.issues.update({
        owner: options.owner,
        repo: options.repo,
        issue_number: options.number,
        ...(options.assignees !== undefined ? { assignees: options.assignees } : {}),
        ...(options.labels !== undefined ? { labels: options.labels } : {}),
        ...(options.milestone !== undefined ? { milestone: options.milestone } : {})
      })
    }
  }
```

- [ ] **Step 3: main/pulls.ts** — the IPC handler `updatePullRequest` takes `changes: unknown`; widen its cast to include the new fields. Find the handler (anchor `function updatePullRequest(`), update the cast:
```ts
  const update = (changes ?? {}) as {
    title?: string
    body?: string
    state?: 'open' | 'closed'
    assignees?: string[]
    labels?: string[]
    milestone?: number | null
  }
```
and ensure the call forwards them (spread `...(update.assignees !== undefined ? { assignees: update.assignees } : {})`, same for labels/milestone) — mirror the `main/issues.ts` `updateIssue` handler exactly.

- [ ] **Step 4: env.d.ts + composable** — widen the `window.ohMyGithub.pulls.updatePullRequest` `changes` type and the `use-pull-requests.ts` `updatePullRequest` `changes` param to:
```ts
{ title?: string, body?: string, state?: 'open' | 'closed', assignees?: string[], labels?: string[], milestone?: number | null }
```
(preload passes `changes` through unchanged — no preload edit needed.)

- [ ] **Step 5: typecheck both + commit**
```bash
pnpm --filter @oh-my-github/api typecheck && pnpm --filter @oh-my-github/client typecheck
git commit -am "feat(pr): updatePullRequest accepts assignees/labels/milestone"
```

---

### Task 3: `requestPullRequestReviewers` mutation

REST `pulls.requestReviewers` (add) + `pulls.removeRequestedReviewers` (remove). The component computes the add/remove diff.

**Files:** all chain layers (`types.ts`, `pulls.ts`, `client.ts`, `mock.ts`, `main/pulls.ts`, `preload/index.ts`, `env.d.ts`, `use-pull-requests.ts`).

**Interface produced:**
- `RequestPullRequestReviewersOptions extends GetPullRequestDetailOptions { reviewers: string[]; removeReviewers: string[] }`
- `requestPullRequestReviewers(options): Promise<void>` (GitHubClient)
- renderer `requestPullRequestReviewers(owner, repo, number, reviewers: string[], removeReviewers: string[]): Promise<void>`

- [ ] **Step 1: types.ts** — add the option interface near the other PR options, and the method to `GitHubClient`:
```ts
export interface RequestPullRequestReviewersOptions extends GetPullRequestDetailOptions {
  reviewers: string[]
  removeReviewers: string[]
}
```
GitHubClient (next to `closePullRequest`): `requestPullRequestReviewers(options: RequestPullRequestReviewersOptions): Promise<void>`.

- [ ] **Step 2: PullsApi method** (`pulls.ts`, import `RequestPullRequestReviewersOptions`):
```ts
  async requestPullRequestReviewers(options: RequestPullRequestReviewersOptions): Promise<void> {
    if (options.removeReviewers.length > 0) {
      await this.octokit.rest.pulls.removeRequestedReviewers({
        owner: options.owner, repo: options.repo, pull_number: options.number, reviewers: options.removeReviewers
      })
    }
    if (options.reviewers.length > 0) {
      await this.octokit.rest.pulls.requestReviewers({
        owner: options.owner, repo: options.repo, pull_number: options.number, reviewers: options.reviewers
      })
    }
  }
```

- [ ] **Step 3: client.ts delegate** — `requestPullRequestReviewers: (options) => pulls.requestPullRequestReviewers(options),` in the PR delegate block.

- [ ] **Step 4: mock.ts** — `async requestPullRequestReviewers(): Promise<void> { return }` in the mock PR stubs block.

- [ ] **Step 5: main/pulls.ts** — register + handler (mirror `closePullRequest` but with two string arrays):
```ts
  ipcMain.handle('pulls:request-reviewers', (_event, owner: string, repo: string, number: number, reviewers: string[], removeReviewers: string[]) =>
    requestPullRequestReviewers(owner, repo, number, reviewers, removeReviewers)
  )
```
```ts
async function requestPullRequestReviewers(owner: string, repo: string, number: number, reviewers: string[], removeReviewers: string[]) {
  const normalizedOptions = normalizePullRequestDetailOptions({ owner, repo, number })
  const api = await createAuthenticatedGitHubApi()
  return api.pulls.requestPullRequestReviewers({
    ...normalizedOptions,
    reviewers: Array.isArray(reviewers) ? reviewers : [],
    removeReviewers: Array.isArray(removeReviewers) ? removeReviewers : []
  })
}
```

- [ ] **Step 6: preload** — `requestPullRequestReviewers: (owner: string, repo: string, number: number, reviewers: string[], removeReviewers: string[]) => ipcRenderer.invoke('pulls:request-reviewers', owner, repo, number, reviewers, removeReviewers),`

- [ ] **Step 7: env.d.ts** — `requestPullRequestReviewers: (owner: string, repo: string, number: number, reviewers: string[], removeReviewers: string[]) => Promise<void>` in the `pulls` window type.

- [ ] **Step 8: composable** — in `use-pull-requests.ts`:
```ts
export async function requestPullRequestReviewers(
  owner: string, repo: string, pullRequestNumber: number, reviewers: string[], removeReviewers: string[],
): Promise<void> {
  if (!window.ohMyGithub?.pulls) throw new Error('GitHub pull requests bridge is unavailable')
  return window.ohMyGithub.pulls.requestPullRequestReviewers(owner, repo, pullRequestNumber, reviewers, removeReviewers)
}
```

- [ ] **Step 9: typecheck both + commit**
```bash
pnpm --filter @oh-my-github/api typecheck && pnpm --filter @oh-my-github/client typecheck
git commit -am "feat(pr): add requestPullRequestReviewers mutation"
```

---

### Task 4: Sidebar editing — Reviewers / Assignees / Labels / Milestone pickers + Projects section

Wire `MultiSelectPicker` into the four read-only sections (mirror `issue-sidebar.vue`) and add a read-only Projects section.

**Files:** `pull-request-sidebar.vue`, `i18n/locales/{en,zh}.json`.

- [ ] **Step 1: imports + state** — in `pull-request-sidebar.vue` script, add to the components-barrel import (`from '../../../components'`): `MultiSelectPicker`, `LabelBadge`, `createGitHubAvatarUrl`. Add `Avatar, AvatarFallback, AvatarImage` to the `@oh-my-github/ui` import. Add `ref` to the existing `vue` import. Add the query + mutation imports:
```ts
import {
  useAssignableUsersQuery,
  useRepositoryLabelsQuery,
  useRepositoryMilestonesQuery,
} from '../../../composables/github/use-issues'
import { requestPullRequestReviewers, updatePullRequest } from '../../../composables/github/use-pull-requests'
```
Add saving guard + picker-open refs + queries + a shared `applyUpdate` (copy `applyIssueUpdate` from `issue-sidebar.vue`, calling `updatePullRequest`):
```ts
const isSavingField = ref(false)
const assigneePickerOpen = ref(false)
const labelPickerOpen = ref(false)
const reviewerPickerOpen = ref(false)

const assignableUsersQuery = useAssignableUsersQuery(() => props.pullRequest.owner, () => props.pullRequest.repo, assigneePickerOpen)
const reviewerUsersQuery = useAssignableUsersQuery(() => props.pullRequest.owner, () => props.pullRequest.repo, reviewerPickerOpen)
const repositoryLabelsQuery = useRepositoryLabelsQuery(() => props.pullRequest.owner, () => props.pullRequest.repo, labelPickerOpen)
const repositoryMilestonesQuery = useRepositoryMilestonesQuery(() => props.pullRequest.owner, () => props.pullRequest.repo, () => Boolean(props.pullRequest.owner && props.pullRequest.repo))

const assigneeLogins = computed(() => (props.pullRequest.assignees ?? []).map((a) => a.login))
const assigneeOptions = computed(() => (assignableUsersQuery.data.value ?? []).map((u) => ({ id: u.login, label: u.login, avatarUrl: u.avatarUrl })))
const reviewerLogins = computed(() => (props.pullRequest.reviewRequests ?? []).map((r) => r.reviewer.login))
const reviewerOptions = computed(() => (reviewerUsersQuery.data.value ?? []).map((u) => ({ id: u.login, label: u.login, avatarUrl: u.avatarUrl })))
const labelNames = computed(() => (props.pullRequest.labels ?? []).map((l) => l.name))
const repositoryLabels = computed(() => repositoryLabelsQuery.data.value ?? [])
const labelOptions = computed(() => repositoryLabels.value.map((l) => ({ id: l.name, label: l.name, description: l.description })))
const labelColorByName = computed(() => { const m = new Map<string, string>(); for (const l of repositoryLabels.value) m.set(l.name, l.color); return m })
const milestoneOptions = computed(() => [{ id: '', label: t('pullRequest.sidebar.empty.milestone') }, ...(repositoryMilestonesQuery.data.value ?? []).map((m) => ({ id: String(m.number), label: m.title }))])
const currentMilestoneId = computed(() => props.pullRequest.milestone?.number != null ? String(props.pullRequest.milestone.number) : '')
const milestoneIds = computed(() => currentMilestoneId.value ? [currentMilestoneId.value] : [])

async function applyUpdate(changes: { assignees?: string[], labels?: string[], milestone?: number | null }): Promise<void> {
  if (isSavingField.value) return
  isSavingField.value = true
  try {
    await updatePullRequest(props.pullRequest.owner, props.pullRequest.repo, props.pullRequest.number, changes)
    emit('refetch')
  } finally { isSavingField.value = false }
}
function onAssigneesChange(next: string[]): void { void applyUpdate({ assignees: next }) }
function onLabelsChange(next: string[]): void { void applyUpdate({ labels: next }) }
function onMilestoneSelect(next: string[]): void { const v = next[0] ?? ''; void applyUpdate({ milestone: v === '' ? null : Number(v) }) }
async function onReviewersChange(next: string[]): Promise<void> {
  if (isSavingField.value) return
  const current = reviewerLogins.value
  const added = next.filter((l) => !current.includes(l))
  const removed = current.filter((l) => !next.includes(l))
  if (added.length === 0 && removed.length === 0) return
  isSavingField.value = true
  try {
    await requestPullRequestReviewers(props.pullRequest.owner, props.pullRequest.repo, props.pullRequest.number, added, removed)
    emit('refetch')
  } finally { isSavingField.value = false }
}
```
> The sidebar already declares `const emit = defineEmits<...>()` for `refetch` and has `const { t } = useI18n()` — reuse them. If `emit` is not yet declared, add `const emit = defineEmits<{ refetch: [] }>()`.

- [ ] **Step 2: Reviewers `#action`** — in the Reviewers `WorkItemSidebarSection`, add (gated on `pullRequest.viewerCanUpdate`), with avatar `#option` (copy the assignee `#option` markup from `issue-sidebar.vue`):
```html
<template
  v-if="pullRequest.viewerCanUpdate"
  #action
>
  <MultiSelectPicker
    v-model:open="reviewerPickerOpen"
    :empty-label="t('pullRequest.sidebar.noMatches')"
    :loading="reviewerUsersQuery.isLoading.value"
    :loading-label="t('pullRequest.sidebar.loading')"
    :model-value="reviewerLogins"
    :options="reviewerOptions"
    :search-placeholder="t('pullRequest.sidebar.searchReviewers')"
    :trigger-label="t('pullRequest.sidebar.edit')"
    @update:model-value="onReviewersChange"
  >
    <template #option="{ option }">
      <span class="flex min-w-0 items-center gap-2">
        <Avatar class="size-5 shrink-0">
          <AvatarImage :alt="option.label" :src="option.avatarUrl || createGitHubAvatarUrl(option.label)" />
          <AvatarFallback>{{ option.label.slice(0, 1).toUpperCase() }}</AvatarFallback>
        </Avatar>
        <span class="min-w-0 truncate">{{ option.label }}</span>
      </span>
    </template>
  </MultiSelectPicker>
</template>
```

- [ ] **Step 3: Assignees `#action`** — same `MultiSelectPicker` + avatar `#option`, bound to `assigneePickerOpen` / `assigneeLogins` / `assigneeOptions` / `onAssigneesChange` / `assignableUsersQuery.isLoading.value` / `t('pullRequest.sidebar.searchAssignees')`.

- [ ] **Step 4: Labels `#action`** — `MultiSelectPicker` bound to `labelPickerOpen` / `labelNames` / `labelOptions` / `onLabelsChange`, with `#option` = `<LabelBadge :label="{ name: option.label, color: labelColorByName.get(option.id) ?? '' }" />` and `t('pullRequest.sidebar.searchLabels')`.

- [ ] **Step 5: Milestone `#action`** — `MultiSelectPicker single` bound to `milestoneIds` / `milestoneOptions` / `onMilestoneSelect` / `t('pullRequest.sidebar.searchMilestones')`.

- [ ] **Step 6: Projects section** — add a read-only `WorkItemSidebarSection` (copy the Projects markup from `issue-sidebar.vue`, swapping `issue.projects` → `pullRequest.projects`), inserted before Dates. Add a `const projects = computed(() => props.pullRequest.projects ?? [])`.

- [ ] **Step 7: i18n** — add to **both** `en.json` and `zh.json` under `pullRequest.sidebar`: `edit`, `loading`, `noMatches`, `searchReviewers`, `searchAssignees`, `searchLabels`, `searchMilestones`; and under `pullRequest.sidebar.sections`: `projects`; under `pullRequest.sidebar.empty`: `projects`. (Copy values from the issue equivalents: "Edit"/"编辑", "Search users…"/"搜索用户…", etc.)

- [ ] **Step 8: typecheck + JSON-validity + manual check + commit**
```bash
node -e "JSON.parse(require('fs').readFileSync('packages/client/src/renderer/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('packages/client/src/renderer/i18n/locales/zh.json','utf8')); console.log('JSON OK')"
pnpm --filter @oh-my-github/client typecheck
git commit -am "feat(pr): editable reviewers/assignees/labels/milestone + projects section"
```
Manual: open a PR detail page, confirm each pen-icon picker opens, toggling saves and the list refreshes; Projects renders.

---

### Task 5: Header actions — remove Copy URL, add Subscribe + Lock

Reuse the generic `setIssueSubscription` / `setIssueLock` (node-id / issue-number based). Mirror `issue-header.vue`.

**Files:** `pull-request-header.vue`.

- [ ] **Step 1: imports** — in `pull-request-header.vue`: replace the `Copy` lucide icon import with `Bell, BellOff, Lock, Unlock`; import the mutations: `import { setIssueLock, setIssueSubscription } from '../../../composables/github/use-issues'`; add `DropdownMenuSeparator` to the `@oh-my-github/ui` import.

- [ ] **Step 2: handlers** — remove `copyPullRequestUrl`. Add (copy from `issue-header.vue`, swapping `issue`→`pullRequest`):
```ts
const isBusy = ref(false)
const nodeId = computed(() => props.pullRequest.nodeId ?? '')
const isSubscribed = computed(() => props.pullRequest.viewerSubscription === 'SUBSCRIBED')
const isLocked = computed(() => Boolean(props.pullRequest.locked))

async function runAction(action: () => Promise<void>): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true
  try { await action(); emit('refetch') } finally { isBusy.value = false }
}
function toggleSubscription(): void {
  if (!nodeId.value) return
  void runAction(() => setIssueSubscription(nodeId.value, !isSubscribed.value))
}
function toggleLock(): void {
  void runAction(() => setIssueLock(props.pullRequest.owner, props.pullRequest.repo, props.pullRequest.number, !isLocked.value))
}
```

- [ ] **Step 3: menu** — replace the single Copy URL `DropdownMenuItem` with:
```html
<DropdownMenuItem
  :disabled="isBusy || !nodeId"
  @select="toggleSubscription"
>
  <component :is="isSubscribed ? BellOff : Bell" class="size-3.5" />
  <span>{{ isSubscribed ? t('pullRequest.actions.unsubscribe') : t('pullRequest.actions.subscribe') }}</span>
</DropdownMenuItem>
<template v-if="pullRequest.viewerCanUpdate">
  <DropdownMenuSeparator />
  <DropdownMenuItem
    :disabled="isBusy"
    @select="toggleLock"
  >
    <component :is="isLocked ? Unlock : Lock" class="size-3.5" />
    <span>{{ isLocked ? t('pullRequest.actions.unlock') : t('pullRequest.actions.lock') }}</span>
  </DropdownMenuItem>
</template>
```

- [ ] **Step 4: i18n** — add to `pullRequest.actions` in **both** locales: `subscribe`, `unsubscribe`, `lock`, `unlock` (values copied from the issue equivalents). Remove the now-unused `pullRequest.actions.copyUrl` (optional; harmless if left).

- [ ] **Step 5: typecheck + JSON-validity + manual check + commit**
```bash
node -e "JSON.parse(require('fs').readFileSync('packages/client/src/renderer/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('packages/client/src/renderer/i18n/locales/zh.json','utf8')); console.log('JSON OK')"
pnpm --filter @oh-my-github/client typecheck
git commit -am "feat(pr): header subscribe/lock actions, remove copy url"
```
Manual: open a PR, open the "…" menu, confirm Subscribe/Unsubscribe + Lock/Unlock appear and toggle.

---

## Self-Review

- **Spec coverage:** editable Reviewers (T3+T4) / Assignees (T2+T4) / Labels (T2+T4) / Milestone (T2+T4) ✓; new read-only Projects (T1+T4) ✓; new actions Subscribe+Lock (T1 data + T5 UI) ✓; remove Copy URL (T5) ✓.
- **API reality flags:** `PullRequest` GraphQL has `locked`, `viewerSubscription`, `projectItems` (all real); it has **no `isPinned`** and PRs have **no delete** — none added. Assignees/labels/milestone correctly route via `rest.issues.update`; reviewers via `rest.pulls.requestReviewers`/`removeRequestedReviewers`. Subscribe/Lock reuse the generic issue mutations unchanged (node-id / issue-number based).
- **Type consistency:** `GitHubIssueSubscription` / `GitHubIssueProjectItem` reused (already defined); `UpdatePullRequestOptions` extended consistently across api method, IPC cast, env.d.ts, composable.
- **Untestable-by-CI:** all picker/menu behavior needs manual verification in the dev app (typecheck only proves compilation). Reviewer add/remove diff is computed component-side from `reviewRequests`.

## Out of scope
- PR Pin / Delete (GitHub doesn't support them).
- Editable Projects (read-only only, same as the issue side).
- Reviewer **teams** (the picker offers user candidates from `listAssignableUsers`; team review requests are not added).
