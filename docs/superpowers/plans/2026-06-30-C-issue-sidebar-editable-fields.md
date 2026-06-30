# Sub-project C — Issue Sidebar Editable Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the issue sidebar's **Assignees**, **Labels**, and **Milestone** editable in-app (including "Assign yourself"), backed by real GitHub writes. Issue **Type** editing is included as an optional final task flagged for API verification.

**Architecture:** A single `updateIssue` mutation (REST `octokit.rest.issues.update`, which accepts `assignees`, `labels`, and `milestone` in one call) flows through the established 9-layer chain; on success the component calls `issueQuery.refetch()`. Three new read queries (`listRepositoryLabels`, `listRepositoryMilestones`, `listAssignableUsers`) populate the pickers. A new reusable `MultiSelectPicker` (built on `Popover` + `Command`) handles assignee/label selection; the existing single-select `SearchableSelect` handles milestone. Each sidebar field gets an edit affordance (gear/⚙ in the section's `action` slot or an inline trigger) that opens its picker.

**Tech Stack:** GitHub REST (octokit), Electron IPC, Vue 3 `<script setup>`, `@oh-my-github/ui` (Popover, Command, SearchableSelect, Button), pinia-colada `useQuery`.

## Global Constraints

- **Code style:** no semicolons, single quotes, 2-space indent.
- **Mutation convention (verified in this codebase):** plain async function in the composable — **NOT** `useMutation`. On success the component awaits the mutation then `await issueQuery.refetch()`. No optimistic updates, no cache invalidation helper.
- **`GitHubClient` interface + mock:** any method added to the `GitHubClient` interface (`types.ts`) MUST also be implemented in `packages/api/src/mock.ts` or the api fails to compile.
- **Verification:** `pnpm --filter @oh-my-github/api typecheck`, `pnpm --filter @oh-my-github/client typecheck`; manual edit-flow check in the running dev app (mock returns succeed without network). Pure logic (option-diffing) gets vitest tests where present.
- **Live shared tree:** anchor edits on exact strings.
- **Depends on sub-project A** (label colors / `GitHubLabel`). Independent of B.

---

## The Mutation Recipe (referenced by Task 2)

Adding a mutation touches these layers (file → what to add). Task 2 shows the full concrete code for `updateIssue`; this is the map.

1. `packages/api/src/types.ts` — options interface (`extends GetIssueDetailOptions`) + method signature on the `GitHubClient` interface.
2. `packages/api/src/modules/issues.ts` — method on `IssuesApi` calling octokit; import the options type.
3. `packages/api/src/client.ts` — flat delegate line in `createGitHubApi`'s return object.
4. `packages/api/src/mock.ts` — mock implementation on the mock client class.
5. `packages/client/src/main/issues.ts` — `ipcMain.handle('issues:<channel>', ...)` registration + a handler function (normalize/validate positional args → `api.issues.<method>(options)`).
6. `packages/client/src/preload/index.ts` — bridge method in the `issues` namespace (`ipcRenderer.invoke('issues:<channel>', ...args)`).
7. `packages/client/src/renderer/env.d.ts` — signature in `Window.ohMyGithub.issues`.
8. `packages/client/src/renderer/composables/github/use-issues.ts` — plain exported async fn guarding `window.ohMyGithub?.issues`.
9. Component — call it, then `await issueQuery.refetch()`.

---

### Task 1: Read queries for picker options

Three repo-scoped read queries, each through the query chain (layers 1,2,3,5,6,7,8 — no mutation, returns data). Bundle them; they're the same shape.

**Files:** `types.ts`, `modules/issues.ts`, `client.ts`, `mock.ts`, `main/issues.ts`, `preload/index.ts`, `env.d.ts`, `composables/github/use-issues.ts`.

**Interfaces produced:**
- `listRepositoryLabels(options: RepositoryOptions): Promise<GitHubLabel[]>`
- `listRepositoryMilestones(options: RepositoryOptions): Promise<GitHubIssueMilestone[]>`
- `listAssignableUsers(options: RepositoryOptions): Promise<GitHubActor[]>`
- Renderer composables: `useRepositoryLabelsQuery(owner, repo, enabled)`, `useRepositoryMilestonesQuery(...)`, `useAssignableUsersQuery(...)` — each a `useQuery` keyed `['github','repo-labels'|'repo-milestones'|'assignable-users', owner, repo]`.

- [ ] **Step 1: api methods** — in `IssuesApi` (`modules/issues.ts`) add:
```ts
async listRepositoryLabels(options: RepositoryOptions): Promise<GitHubLabel[]> {
  const response = await this.octokit.rest.issues.listLabelsForRepo({
    owner: options.owner, repo: options.repo, per_page: 100
  })
  return response.data.map((label) => ({
    name: label.name, color: label.color ?? '', description: label.description ?? null
  }))
}

async listRepositoryMilestones(options: RepositoryOptions): Promise<GitHubIssueMilestone[]> {
  const response = await this.octokit.rest.issues.listMilestones({
    owner: options.owner, repo: options.repo, state: 'open', per_page: 100
  })
  return response.data.map((m) => ({
    id: String(m.id), number: m.number, title: m.title, description: m.description ?? null,
    dueOn: m.due_on ?? null, state: m.state === 'closed' ? 'closed' : 'open', url: m.html_url
  }))
}

async listAssignableUsers(options: RepositoryOptions): Promise<GitHubActor[]> {
  const response = await this.octokit.rest.issues.listAssignees({
    owner: options.owner, repo: options.repo, per_page: 100
  })
  return response.data.map((u) => ({ login: u.login, avatarUrl: u.avatar_url }))
}
```
Add `listRepositoryLabels`/`listRepositoryMilestones`/`listAssignableUsers` to the `GitHubClient` interface (`types.ts`), the `client.ts` delegates, and **the mock** (return small static arrays — e.g. `mockLabels('bug','triage')`, one milestone, two actors).

- [ ] **Step 2: IPC + preload + env.d.ts** — register `issues:list-repository-labels`, `issues:list-repository-milestones`, `issues:list-assignable-users` (each handler: normalize owner/repo → `api.issues.<method>({owner,repo})`); add the three bridge methods; add the three signatures to `Window.ohMyGithub.issues`.

- [ ] **Step 3: composables** — in `use-issues.ts` add three `useQuery` factories (model on `useIssueDetailQuery`), each `enabled` only when owner+repo present and a passed `enabled` ref is true (so options are fetched lazily, only when a picker opens).

- [ ] **Step 4: typecheck both packages, commit.** No UI yet — these are consumed in later tasks.

---

### Task 2: The `updateIssue` mutation (assignees / labels / milestone)

**Files:** all 9 recipe layers.

**Interfaces produced:**
- `UpdateIssueOptions extends GetIssueDetailOptions { assignees?: string[]; labels?: string[]; milestone?: number | null }`
- `updateIssue(options: UpdateIssueOptions): Promise<void>`
- Composable: `updateIssue(owner, repo, number, changes: { assignees?: string[]; labels?: string[]; milestone?: number | null }): Promise<void>`

- [ ] **Step 1: types.ts** — add:
```ts
export interface UpdateIssueOptions extends GetIssueDetailOptions {
  assignees?: string[]
  labels?: string[]
  milestone?: number | null
}
```
and on the `GitHubClient` interface: `updateIssue(options: UpdateIssueOptions): Promise<void>`.

- [ ] **Step 2: IssuesApi method** (`modules/issues.ts`):
```ts
async updateIssue(options: UpdateIssueOptions): Promise<void> {
  await this.octokit.rest.issues.update({
    owner: options.owner,
    repo: options.repo,
    issue_number: options.number,
    ...(options.assignees !== undefined ? { assignees: options.assignees } : {}),
    ...(options.labels !== undefined ? { labels: options.labels } : {}),
    ...(options.milestone !== undefined ? { milestone: options.milestone } : {})
  })
}
```
Import `UpdateIssueOptions`.

- [ ] **Step 3: client.ts delegate** — `updateIssue: (options) => issues.updateIssue(options)`.

- [ ] **Step 4: mock.ts** — `async updateIssue(): Promise<void> { return }` (no-op; the component refetch returns mock detail).

- [ ] **Step 5: main/issues.ts** — register:
```ts
ipcMain.handle('issues:update', (_event, owner: string, repo: string, number: number, changes: unknown) =>
  updateIssue(owner, repo, number, changes)
)
```
and handler:
```ts
async function updateIssue(owner: string, repo: string, number: number, changes: unknown) {
  const o = owner.trim(); const r = repo.trim(); const n = Number(number)
  if (!o || !r) throw new Error('Repository owner and name are required')
  if (!Number.isInteger(n) || n <= 0) throw new Error('Issue number must be a positive integer')
  const c = (changes ?? {}) as { assignees?: string[]; labels?: string[]; milestone?: number | null }
  const api = await createAuthenticatedGitHubApi()
  return api.issues.updateIssue({
    owner: o, repo: r, number: n,
    ...(c.assignees !== undefined ? { assignees: c.assignees } : {}),
    ...(c.labels !== undefined ? { labels: c.labels } : {}),
    ...(c.milestone !== undefined ? { milestone: c.milestone } : {})
  })
}
```

- [ ] **Step 6: preload** — `updateIssue: (owner: string, repo: string, number: number, changes: unknown) => ipcRenderer.invoke('issues:update', owner, repo, number, changes)`.

- [ ] **Step 7: env.d.ts** — `updateIssue: (owner: string, repo: string, number: number, changes: { assignees?: string[]; labels?: string[]; milestone?: number | null }) => Promise<void>`.

- [ ] **Step 8: composable** — in `use-issues.ts`:
```ts
export async function updateIssue(
  owner: string, repo: string, issueNumber: number,
  changes: { assignees?: string[]; labels?: string[]; milestone?: number | null }
): Promise<void> {
  if (!window.ohMyGithub?.issues) throw new Error('GitHub issues bridge is unavailable')
  return window.ohMyGithub.issues.updateIssue(owner, repo, issueNumber, changes)
}
```

- [ ] **Step 9: typecheck both, commit.**

---

### Task 3: `MultiSelectPicker` component (Popover + Command)

A reusable multi-select with search and checkmarks, mirroring `searchable-select.vue` but keeping the panel open and emitting an array. Used by Assignees and Labels.

**Files:** Create `packages/client/src/renderer/components/navigation/multi-select-picker.vue`; export from `packages/client/src/renderer/components/index.ts`.

**Interface:**
- Props: `options: Array<{ id: string; label: string; description?: string | null }>`, `modelValue: string[]`, `placeholder`, `searchPlaceholder`, `emptyLabel`, `triggerLabel`, `loading?: boolean`, `disabled?: boolean`. Optional `#option` slot to customize each row (so Labels can render a colored `LabelBadge`).
- Emits: `update:modelValue: string[]` (toggles, panel stays open).

- [ ] **Step 1: build it** — full SFC:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import {
  Button, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
  Popover, PopoverContent, PopoverTrigger
} from '@oh-my-github/ui'

const props = defineProps<{
  options: Array<{ id: string, label: string, description?: string | null }>
  modelValue: string[]
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  triggerLabel: string
  loading?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const selected = computed(() => new Set(props.modelValue))

function toggle(id: string): void {
  const next = new Set(props.modelValue)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  emit('update:modelValue', [...next])
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        class="h-7 px-2 text-xs text-muted-foreground"
        :disabled="disabled"
        size="sm"
        type="button"
        variant="outline"
      >
        {{ triggerLabel }}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-64 p-0" menu>
      <Command :model-value="undefined">
        <CommandInput :placeholder="searchPlaceholder" size="md" />
        <CommandList>
          <CommandEmpty>{{ loading ? placeholder : emptyLabel }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="option in options"
              :key="option.id"
              :value="option.label"
              @select="toggle(option.id)"
            >
              <Check class="size-4" :class="selected.has(option.id) ? 'opacity-100' : 'opacity-0'" />
              <slot name="option" :option="option">
                <span class="truncate">{{ option.label }}</span>
              </slot>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
```
Export `MultiSelectPicker` from the components barrel. Typecheck client.

- [ ] **Step 2: commit.**

---

### Task 4: Editable Assignees (+ "Assign yourself")

**Files:** `issue-sidebar.vue`; `use-issues.ts` (viewer login — reuse existing identity composable if present, else fetch from `window.ohMyGithub`).

- [ ] **Step 1** — in `issue-sidebar.vue` script: add an `isEditingAssignees` ref / use the picker open state; lazily call `useAssignableUsersQuery(issue.owner, issue.repo, enabled)` where `enabled` flips true when the picker opens. Map users → `{ id: login, label: login }`. Track current selection from `issue.assignees.map(a => a.login)`.

- [ ] **Step 2** — add the picker to the Assignees section's `action` slot:
```html
<template #action>
  <MultiSelectPicker
    :model-value="assigneeLogins"
    :options="assigneeOptions"
    :loading="assigneesQuery.isLoading.value"
    :trigger-label="t('issue.sidebar.edit')"
    :search-placeholder="t('issue.sidebar.assigneesSearch')"
    :empty-label="t('issue.sidebar.empty.assignees')"
    @update:model-value="onAssigneesChange"
  />
</template>
```
where `onAssigneesChange(next)` calls `await updateIssue(issue.owner, issue.repo, issue.number, { assignees: next })` then `emit('refetch')` (the sidebar should emit a `refetch` event the page handles by `issueQuery.refetch()` — add this emit + wire it in `issue-page.vue`'s `<IssueSidebar @refetch="issueQuery.refetch()">`).

- [ ] **Step 3** — "Assign yourself": when `issue.assignees` is empty, render an `Assign yourself` button that calls `onAssigneesChange([viewerLogin])`. Get `viewerLogin` from the existing auth/identity composable (search `composables/github` for the viewer login source used elsewhere).

- [ ] **Step 4** — typecheck, manual check (open picker, toggle, list updates after refetch), commit.

---

### Task 5: Editable Labels

- [ ] **Step 1** — `useRepositoryLabelsQuery` lazily; map to `{ id: name, label: name, description }`; current selection = `issue.labels.map(l => l.name)`.
- [ ] **Step 2** — add `MultiSelectPicker` to the Labels section `action` slot, using the `#option` slot to render `<LabelBadge :label="{ name: option.label, color: colorFor(option.id) }" />` (look up color from the fetched repo labels). `@update:model-value` → `updateIssue({ labels: next })` → refetch.
- [ ] **Step 3** — typecheck, manual check, commit.

---

### Task 6: Editable Milestone

- [ ] **Step 1** — `useRepositoryMilestonesQuery` lazily; map to `SearchableSelectOption[]` `{ id: String(number), label: title }`; prepend a "No milestone" option with `id: ''`.
- [ ] **Step 2** — add `SearchableSelect` (single-select, reused) to the Milestone section `action` slot; `@update:model-value` → `updateIssue({ milestone: value === '' ? null : Number(value) })` → refetch.
- [ ] **Step 3** — typecheck, manual check, commit.

---

### Task 7 (OPTIONAL): Editable Type — VERIFY API FIRST

> ⚠️ Issue types are org-configured and the REST `issues.update` does **not** set them. Setting a type needs GraphQL — likely `updateIssue(input: { id, issueTypeId })` plus a `repository.owner.issueTypes` query for options. **Before implementing, verify these mutations/fields exist for the target org** (they are relatively new and may be unavailable). If unavailable, leave Type read-only (from sub-project B) and stop here.

- [ ] **Step 1** — verify `updateIssue(input:{issueTypeId})` GraphQL mutation availability; if OK, add a `setIssueType` mutation (recipe) calling `octokit.graphql` with the mutation, a `listIssueTypes` read query (org-level), and a `SearchableSelect` in the Type section. Else: document that Type editing is blocked by API and remains read-only.

---

## Self-Review checklist
- Every mutation/read method added to `GitHubClient` is implemented in `mock.ts` (api typecheck enforces).
- Picker option queries are `enabled`-gated so they fire only when a picker opens (no eager network on page load).
- After every edit the component triggers `issueQuery.refetch()` (via the sidebar `@refetch` emit) — no stale UI.
- i18n keys (`issue.sidebar.edit`, `assigneesSearch`, etc.) added to both `en.json` and `zh.json`.

## Out of scope
- Read-only Type/Relationships/Projects display → sub-project B.
- Subscribe + lock/pin/transfer/delete/convert → sub-project D.
