# Sub-project B — Issue Sidebar Read-Only Sections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add read-only sidebar sections to the issue detail page — **Type**, **Relationships** (parent / sub-issues / tracked), **Development** (linked branches & closing PRs, replacing the current dead section), and **Projects** (membership + a Priority-style field value) — all display-only, no mutations.

**Architecture:** Extend the existing `issueDetailQuery` GraphQL selection with new `Issue` fields, model them on `GraphQLIssueDetailNode`, map them in `mapIssueDetailNode` to new `GitHubIssueDetail` fields, mirror those field names on the renderer `IssueDetail` type (the IPC payload is cast directly, no transform layer), then render new `<WorkItemSidebarSection>` blocks in `issue-sidebar.vue`. Add i18n keys to both `en.json` and `zh.json`.

**Tech Stack:** GitHub GraphQL, TypeScript, Vue 3 `<script setup>`, vue-i18n.

## Global Constraints

- **Code style (match surrounding files):** no semicolons, single quotes, 2-space indent.
- **No mutations in B** — display only.
- **Field-name parity:** every field added to api `GitHubIssueDetail` MUST be added with the **identical name and a structurally-compatible shape** to renderer `IssueDetail` (`packages/client/src/renderer/pages/issue/components/types.ts`), because `issue-page.vue` casts the IPC payload `as IssueDetail` with no transform.
- **env.d.ts mirror:** `GitHubIssueDetail` is also mirrored in `packages/client/src/renderer/env.d.ts` — keep it in sync.
- **Verification:** `pnpm --filter @oh-my-github/api typecheck` and `pnpm --filter @oh-my-github/client typecheck`. Pure api mapper helpers get vitest unit tests (api vitest already exists from sub-project A). Sections are confirmed visually in the running dev app.
- **The app runs in `electron-vite dev` with concurrent editing — anchor edits on exact strings, not line numbers.**
- **GraphQL field availability:** `issueType`, `parent`, `subIssues`, `trackedIssues`, `trackedInIssues`, `linkedBranches`, `closedByPullRequestsReferences` are on the GraphQL `Issue` type. `projectItems` (Projects v2) requires the `read:project` scope — if absent the query returns null for that field; the mapper must tolerate null (render the section empty, never throw).

---

### Task 1: Development section — real data (replace the dead path)

The sidebar already has a Development section gated on `shouldShowDevelopment`, reading `issue.development`/`issue.linkedWork` which the API never populates. Populate them for real from `linkedBranches` + `closedByPullRequestsReferences`.

**Files:**
- Modify: `packages/api/src/modules/issues.ts` (query + node type + mapper)
- Modify: `packages/api/src/types.ts` (`GitHubIssueDetail` + new sub-types)
- Modify: `packages/client/src/renderer/env.d.ts` (mirror)
- Modify: `packages/client/src/renderer/pages/issue/components/types.ts` (already has `IssueDevelopmentSummary` / `IssueLinkedWorkSummary` — verify shape)
- Create: `packages/api/src/modules/issues.development.test.ts`

**Interfaces:**
- Produces on `GitHubIssueDetail`: `development: GitHubIssueDevelopment | null` where
  `interface GitHubIssueDevelopment { branches: number | null; commits: number | null; pullRequests: GitHubIssueLinkedRef[] }`
  and `interface GitHubIssueLinkedRef { id: string; number: number; title: string | null; state: string | null; url: string | null }`.

- [ ] **Step 1: Add the GraphQL fields to `issueDetailQuery`**

In `packages/api/src/modules/issues.ts`, in the `issueDetailQuery` selection, add as siblings of `reactionGroups` (just before the `Issue {` block closes). Anchor on the `reactionGroups` block inside the issue selection:

old:
```
    reactionGroups {
      content
      reactors {
        totalCount
      }
      viewerHasReacted
    }
```
new (append the two connections after it — keep the existing `reactionGroups` block, add below it):
```
    reactionGroups {
      content
      reactors {
        totalCount
      }
      viewerHasReacted
    }
    linkedBranches(first: 10) {
      nodes {
        id
        ref {
          name
        }
      }
    }
    closedByPullRequestsReferences(first: 10, includeClosedPrs: true) {
      nodes {
        id
        number
        title
        state
        url
      }
    }
```
> If `reactionGroups` appears more than once (it also appears under `comments`), disambiguate by matching the issue-level one — it is the block immediately before the `Issue {` selection closes. Read the file region first to confirm the unique surrounding context.

- [ ] **Step 2: Extend `GraphQLIssueDetailNode`**

In `packages/api/src/modules/issues.ts`, add to the `GraphQLIssueDetailNode` interface (anchor on its `reactionGroups` field):

old:
```ts
  reactionGroups?: GraphQLReactionGroup[] | null
}
```
new:
```ts
  reactionGroups?: GraphQLReactionGroup[] | null
  linkedBranches?: { nodes?: Array<{ id: string; ref?: { name: string } | null } | null> | null } | null
  closedByPullRequestsReferences?: {
    nodes?: Array<{ id: string; number: number; title?: string | null; state?: string | null; url?: string | null } | null> | null
  } | null
}
```

- [ ] **Step 3: Add the api types**

In `packages/api/src/types.ts`, add before `GitHubIssueDetail`:
```ts
export interface GitHubIssueLinkedRef {
  id: string
  number: number
  title: string | null
  state: string | null
  url: string | null
}

export interface GitHubIssueDevelopment {
  branches: number | null
  commits: number | null
  pullRequests: GitHubIssueLinkedRef[]
}
```
Add the field to `GitHubIssueDetail` (anchor on its `reactions`/`url` tail):
old:
```ts
  reactions: GitHubIssueReaction[]
  url: string
  hasUpdates: boolean
}
```
new:
```ts
  reactions: GitHubIssueReaction[]
  development: GitHubIssueDevelopment | null
  url: string
  hasUpdates: boolean
}
```

- [ ] **Step 4: Write the failing mapper test**

Create `packages/api/src/modules/issues.development.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { mapIssueDevelopment } from './issues'

describe('mapIssueDevelopment', () => {
  it('maps closing PR references and branch count', () => {
    const result = mapIssueDevelopment({
      linkedBranches: { nodes: [{ id: 'b1', ref: { name: 'feat/x' } }] },
      closedByPullRequestsReferences: {
        nodes: [{ id: 'pr1', number: 12, title: 'Fix', state: 'OPEN', url: 'https://x/pull/12' }]
      }
    })
    expect(result).toEqual({
      branches: 1,
      commits: null,
      pullRequests: [{ id: 'pr1', number: 12, title: 'Fix', state: 'OPEN', url: 'https://x/pull/12' }]
    })
  })

  it('returns null when there is no development data', () => {
    expect(mapIssueDevelopment({})).toBeNull()
    expect(mapIssueDevelopment({ linkedBranches: { nodes: [] }, closedByPullRequestsReferences: { nodes: [] } })).toBeNull()
  })
})
```

- [ ] **Step 5: Run the test — verify it fails**

Run: `pnpm --filter @oh-my-github/api exec vitest run src/modules/issues.development.test.ts`
Expected: FAIL — `mapIssueDevelopment` not exported.

- [ ] **Step 6: Implement `mapIssueDevelopment` and call it in `mapIssueDetailNode`**

In `packages/api/src/modules/issues.ts`, add the exported helper near `mapMilestone`:
```ts
export function mapIssueDevelopment(
  node: Pick<GraphQLIssueDetailNode, 'linkedBranches' | 'closedByPullRequestsReferences'>
): GitHubIssueDevelopment | null {
  const branchNodes = (node.linkedBranches?.nodes ?? []).filter((b): b is NonNullable<typeof b> => Boolean(b))
  const prNodes = (node.closedByPullRequestsReferences?.nodes ?? []).filter(
    (p): p is NonNullable<typeof p> => Boolean(p)
  )
  const pullRequests = prNodes.map((pr) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title ?? null,
    state: pr.state ?? null,
    url: pr.url ?? null
  }))

  if (branchNodes.length === 0 && pullRequests.length === 0) return null

  return {
    branches: branchNodes.length > 0 ? branchNodes.length : null,
    commits: null,
    pullRequests
  }
}
```
Import `GitHubIssueDevelopment` in the issues.ts type-import block. Then add to the object returned by `mapIssueDetailNode` (anchor on its `reactions:` line):
old:
```ts
    reactions: mapReactions(node.reactionGroups),
    url: node.url,
```
new:
```ts
    reactions: mapReactions(node.reactionGroups),
    development: mapIssueDevelopment(node),
    url: node.url,
```

- [ ] **Step 7: Run the test — verify it passes**

Run: `pnpm --filter @oh-my-github/api exec vitest run src/modules/issues.development.test.ts`
Expected: PASS (2).

- [ ] **Step 8: Mirror the field on the renderer side**

In `packages/client/src/renderer/env.d.ts`, add to the `GitHubIssueDetail` mirror (anchor on its `reactions`/`url` tail, same as Task A): insert `development: { branches: number | null; commits: number | null; pullRequests: Array<{ id: string; number: number; title: string | null; state: string | null; url: string | null }> } | null` before `url: string`.

In `packages/client/src/renderer/pages/issue/components/types.ts`, the existing `IssueDevelopmentSummary` is `{ branches?, commits?, pullRequests? }` and `IssueDetail.development?` already exists — no change needed; the api shape is assignable. Confirm by typecheck.

- [ ] **Step 9: Update mock + typecheck**

In `packages/api/src/mock.ts`, the issue-detail mock (where `createMockIssueDetail` builds the object) — add `development: null,` to the returned object (anchor on its `reactions:` or `url:` line; read the region first). Then:
```bash
pnpm --filter @oh-my-github/api typecheck && pnpm --filter @oh-my-github/client typecheck
```
Expected: both exit 0. The existing Development section in `issue-sidebar.vue` now renders for issues that have closing PRs/branches.

- [ ] **Step 10: Commit**
```bash
git add packages/api/src/modules/issues.ts packages/api/src/modules/issues.development.test.ts \
  packages/api/src/types.ts packages/api/src/mock.ts packages/client/src/renderer/env.d.ts
git commit -m "feat(issue): populate Development sidebar with real linked branches/PRs"
```

---

### Task 2: Type section

**Files:** `issues.ts` (query/node/mapper), `types.ts`, `env.d.ts`, renderer `types.ts`, `issue-sidebar.vue`, `en.json`, `zh.json`, `mock.ts`.

**Interfaces:** `GitHubIssueDetail.issueType: GitHubIssueType | null` where `interface GitHubIssueType { name: string; color: string | null; description: string | null }`.

- [ ] **Step 1: GraphQL field** — in `issueDetailQuery`, add after `...IssueFields` (anchor on `createdAt`):
old:
```
    ...IssueFields
    createdAt
```
new:
```
    ...IssueFields
    issueType {
      name
      color
      description
    }
    createdAt
```

- [ ] **Step 2: node type** — add to `GraphQLIssueDetailNode`: `issueType?: { name: string; color?: string | null; description?: string | null } | null`.

- [ ] **Step 3: api type** — add `GitHubIssueType` interface near the other issue types, and `issueType: GitHubIssueType | null` on `GitHubIssueDetail` (anchor on `labels:` line, insert after it).

- [ ] **Step 4: mapper** — add to `mapIssueDetailNode`:
```ts
    issueType: node.issueType
      ? { name: node.issueType.name, color: node.issueType.color ?? null, description: node.issueType.description ?? null }
      : null,
```
(insert after `labels: mapLabels(node.labels),`).

- [ ] **Step 5: renderer mirror** — add `issueType: { name: string; color: string | null; description: string | null } | null` to the env.d.ts `GitHubIssueDetail` mirror, and add `issueType?: IssueTypeSummary | null` + `export interface IssueTypeSummary { name: string; color?: string | null; description?: string | null }` to renderer `types.ts`. Add `issueType: null` to the mock issue detail object.

- [ ] **Step 6: i18n** — add `"type": "Type"` to `issue.sidebar.sections` and `"type": "No type"` to `issue.sidebar.empty` in `en.json`; `"type": "类型"` / `"type": "没有类型"` in `zh.json` (keep keys alphabetically sorted within each object).

- [ ] **Step 7: render the section** — in `issue-sidebar.vue`, after the Labels `</WorkItemSidebarSection>`, add:
```html
    <WorkItemSidebarSection :title="t('issue.sidebar.sections.type')">
      <span
        v-if="issue.issueType"
        class="inline-flex items-center rounded-full border px-2 py-0.5 text-body font-medium"
        :title="issue.issueType.description ?? undefined"
      >
        {{ issue.issueType.name }}
      </span>
      <p
        v-else
        class="text-body text-muted-foreground"
      >
        {{ t('issue.sidebar.empty.type') }}
      </p>
    </WorkItemSidebarSection>
```

- [ ] **Step 8: typecheck both packages, then commit**
```bash
pnpm --filter @oh-my-github/api typecheck && pnpm --filter @oh-my-github/client typecheck
git add -A && git commit -m "feat(issue): add read-only Type sidebar section"
```
> (`git add -A` here is scoped by you to the touched files; in the live shared tree stage only your files.)

---

### Task 3: Relationships section (parent / sub-issues / tracked)

**Interfaces:** `GitHubIssueDetail.relationships: GitHubIssueRelationships` where
```ts
interface GitHubIssueRelationships {
  parent: GitHubIssueLinkedRef | null
  subIssues: GitHubIssueLinkedRef[]
  tracked: GitHubIssueLinkedRef[]
}
```
(reuses `GitHubIssueLinkedRef` from Task 1.)

- [ ] **Step 1: GraphQL** — add to `issueDetailQuery` (siblings of `reactionGroups`):
```
    parent {
      id
      number
      title
      state
      url
    }
    subIssues(first: 20) {
      nodes { id number title state url }
    }
    trackedIssues(first: 20) {
      nodes { id number title state url }
    }
```

- [ ] **Step 2: node type** — add `parent?`, `subIssues?`, `trackedIssues?` (each `{ nodes?: Array<{ id; number; title?; state?; url? } | null> } | null`, parent is the single-object form) to `GraphQLIssueDetailNode`.

- [ ] **Step 3: api type** — add `GitHubIssueRelationships` and `relationships: GitHubIssueRelationships` on `GitHubIssueDetail`.

- [ ] **Step 4: mapper** — add a `mapLinkedRef` + `mapLinkedRefs` helper (reuse the closing-PR mapping shape from Task 1) and a `mapIssueRelationships(node)` returning `{ parent, subIssues, tracked }`; call it in `mapIssueDetailNode` (`relationships: mapIssueRelationships(node),`). Cover `mapIssueRelationships` with a vitest unit test (`issues.relationships.test.ts`): parent present, sub-issues list, all-empty → `{ parent: null, subIssues: [], tracked: [] }`.

- [ ] **Step 5: renderer mirror** — add the `relationships` shape to env.d.ts `GitHubIssueDetail` mirror and `relationships?: IssueRelationshipsSummary` to renderer `types.ts` (reusing `IssueLinkedWorkSummary` for the refs). Add `relationships: { parent: null, subIssues: [], tracked: [] }` to the mock.

- [ ] **Step 6: i18n** — `sections.relationships` = "Relationships"/"关联", `empty.relationships` = "None yet"/"暂无", plus nested `relationships.parent`/`relationships.subIssues`/`relationships.tracked` labels.

- [ ] **Step 7: render** — add a `<WorkItemSidebarSection :title="t('issue.sidebar.sections.relationships')">` after Milestone, listing parent (if any), sub-issues, and tracked, each via the existing `<GitHubReferenceLink>` component (already imported in the sidebar; pass `:number`, `:owner`, `:repo` parsed from the ref url via `parseGitHubReferenceUrl`, `initial-kind="issue"`). Empty → `empty.relationships`.

- [ ] **Step 8: typecheck both + the new test, commit.**

---

### Task 4: Projects section (read-only, with Priority-style field value)

> Requires `read:project` scope. The mapper MUST treat a null `projectItems` as "no projects" and never throw.

**Interfaces:** `GitHubIssueDetail.projects: GitHubIssueProjectItem[]` where
```ts
interface GitHubIssueProjectItem {
  id: string
  title: string
  url: string | null
  fields: Array<{ name: string; value: string }>   // e.g. { name: 'Priority', value: 'High' }
}
```

- [ ] **Step 1: GraphQL** — add to `issueDetailQuery`:
```
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

- [ ] **Step 2: node type** — add `projectItems?` with a permissive shape (the field-value nodes are a `__typename`-discriminated union; type the relevant members optionally).

- [ ] **Step 3: api type + mapper** — add `GitHubIssueProjectItem` and `projects: GitHubIssueProjectItem[]` on `GitHubIssueDetail`; implement `mapIssueProjects(node)` that flattens each project item into `{ id, title, url, fields }`, extracting single-select/text/number field values into `{ name, value }` (skip unnamed/empty). Unit test `issues.projects.test.ts`: a single-select "Priority"→"High" maps to `fields: [{ name: 'Priority', value: 'High' }]`; null `projectItems` → `[]`.

- [ ] **Step 4: renderer mirror + mock** — mirror in env.d.ts and renderer `types.ts` (`projects?: IssueProjectSummary[]`); mock `projects: []`.

- [ ] **Step 5: i18n** — `sections.projects` = "Projects"/"项目", `empty.projects` = "No projects"/"没有项目".

- [ ] **Step 6: render** — `<WorkItemSidebarSection :title="t('issue.sidebar.sections.projects')">` listing each project (title as a link to `url`) and, beneath it, each field as `name: value` muted rows. Empty → `empty.projects`. Insert before the Development section.

- [ ] **Step 7: typecheck both + new test, commit.**

---

## Self-Review checklist (run before handoff)
- Every new `GitHubIssueDetail` field has a matching env.d.ts mirror field AND renderer `IssueDetail` field with a compatible shape (cast stays valid).
- Every new GraphQL field has a corresponding `GraphQLIssueDetailNode` optional field and is mapped in `mapIssueDetailNode`.
- Mappers tolerate null/missing connections (Projects especially) and never throw.
- `mock.ts` issue-detail object sets every new field (api typecheck enforces this).
- Both `en.json` and `zh.json` updated; keys alphabetically sorted.

## Out of scope (other sub-projects)
- Editing any of these fields → sub-project C.
- The actions menu / subscribe → sub-project D.
