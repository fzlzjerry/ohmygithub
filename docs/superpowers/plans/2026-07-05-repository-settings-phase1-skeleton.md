# Repository Settings 阶段 1(骨架)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为仓库页 Sidebar 增加通用可折叠子项能力,并落地 Settings 标签页骨架:5 个分类 tab id、二级 sub 路由、admin 权限门控、5 个分类页壳(全部子页以 ↗ 外链占位)。

**Architecture:** 泛化 `SectionSidebar`(items 支持 `children` + `defaultExpanded`);`RepositoryTabId` 用 5 个 `settings*` id 替换原 `settings`;URL 层用 `?tab=settings-automation&sub=webhooks` 编码;权限来自 REST `GET /repos/{owner}/{repo}` 的 `permissions.admin`(经 overview 透出为 `viewerCanAdminister`)。这是 spec(`docs/superpowers/specs/2026-07-05-repository-settings-design.md`)Part 7 六阶段中的第 1 阶段,后续阶段(General、Access……)各有独立计划。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript、vue-i18n(en/zh 双语)、vitest、pnpm workspace(packages/api = Octokit 封装,packages/client = Electron 客户端)。

## Global Constraints

- 每个 Task 结束时必须通过:`pnpm --filter @oh-my-github/client test` 与 `pnpm --filter @oh-my-github/client typecheck`(涉及 packages/api 时还有 `pnpm --filter @oh-my-github/api test`)。
- i18n:任何新文案必须同时进 `en.json` 和 `zh.json`;文案里的 `@` 必须写成 `{'@'}`(`locales.test.ts` 会守护)。
- UI 约定:bordered 圆角容器只放列表行;表单不套边框卡片(本阶段只有列表,天然满足)。
- 图标一律 `lucide-vue-next`,`:stroke-width="1.75"`、`size-3.5` 与现有 sidebar 一致。
- Commit 用 conventional commits,消息末尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 用户本地跑着 HMR dev 实例;UI 改动直接改,不做额外的自动化 UI 验证。

---

### Task 1: SectionSidebar 支持可折叠子项

**Files:**
- Modify: `packages/client/src/renderer/components/navigation/section-sidebar.vue`(全量替换,原文件 65 行)

**Interfaces:**
- Consumes: 无(纯组件改造)
- Produces: `SectionSidebarItem` 新增 `children?: readonly SectionSidebarChildItem[]`、`defaultExpanded?: boolean`;新导出 `interface SectionSidebarChildItem { id: string; label: string; disabled?: boolean }`。行为:点父项行 → `emit('update:activeId', 父id)` 并展开;点 chevron 只折叠/展开;`activeId` 命中子项时子项亮指示条、父项文字保持 foreground,且若父项折叠会自动展开。

- [ ] **Step 1: 全量重写组件**

用以下内容替换 `section-sidebar.vue` 全文:

```vue
<script setup lang="ts">
import type { Component } from 'vue'
import { ref, watch } from 'vue'
import { ChevronRight } from 'lucide-vue-next'

export interface SectionSidebarChildItem {
  id: string
  label: string
  disabled?: boolean
}

export interface SectionSidebarItem {
  id: string
  label: string
  icon: Component
  countLabel?: string | null
  disabled?: boolean
  children?: readonly SectionSidebarChildItem[]
  defaultExpanded?: boolean
}

const props = defineProps<{
  activeId: string
  items: readonly SectionSidebarItem[]
  navigationLabel: string
}>()

const emit = defineEmits<{
  'update:activeId': [value: string]
}>()

const expandedIds = ref(new Set(
  props.items
    .filter((item) => hasChildren(item) && item.defaultExpanded)
    .map((item) => item.id),
))

function hasChildren(item: SectionSidebarItem): boolean {
  return (item.children?.length ?? 0) > 0
}

function isExpanded(item: SectionSidebarItem): boolean {
  return expandedIds.value.has(item.id)
}

function isParentOfActive(item: SectionSidebarItem): boolean {
  return item.children?.some((child) => child.id === props.activeId) ?? false
}

function toggleExpanded(id: string): void {
  const next = new Set(expandedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedIds.value = next
}

function selectItem(item: SectionSidebarItem): void {
  emit('update:activeId', item.id)

  if (hasChildren(item) && !expandedIds.value.has(item.id)) {
    expandedIds.value = new Set([...expandedIds.value, item.id])
  }
}

watch(
  () => [props.activeId, props.items] as const,
  ([activeId, items]) => {
    const parent = items.find((item) => item.children?.some((child) => child.id === activeId))
    if (parent && !expandedIds.value.has(parent.id)) {
      expandedIds.value = new Set([...expandedIds.value, parent.id])
    }
  },
  { immediate: true },
)
</script>

<template>
  <aside class="flex h-full w-56 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
    <slot name="header" />

    <nav
      class="grid gap-1 px-2 py-1.5"
      :aria-label="navigationLabel"
    >
      <template
        v-for="item in items"
        :key="item.id"
      >
        <div class="relative">
          <button
            :class="[
              'grid h-9 w-full grid-cols-[0.25rem_1rem_minmax(0,1fr)_auto] items-center gap-x-1 rounded-lg text-left text-body font-normal outline-hidden transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50',
              hasChildren(item) ? 'pr-8' : 'pr-2',
              activeId === item.id || isParentOfActive(item) ? 'text-foreground' : 'text-muted-foreground',
            ]"
            :aria-current="activeId === item.id ? 'page' : undefined"
            :disabled="item.disabled"
            type="button"
            @click="selectItem(item)"
          >
            <span
              class="h-4 w-0.5 justify-self-center rounded-full"
              :class="activeId === item.id ? 'bg-muted-foreground' : 'bg-transparent'"
            />
            <component
              :is="item.icon"
              class="size-3.5 justify-self-center"
              :stroke-width="1.75"
            />
            <span class="ml-1 min-w-0 truncate select-none">
              {{ item.label }}
            </span>
            <span
              v-if="item.countLabel"
              class="select-none tabular-nums text-muted-foreground opacity-70"
            >
              {{ item.countLabel }}
            </span>
          </button>

          <button
            v-if="hasChildren(item)"
            class="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-hidden transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
            :aria-expanded="isExpanded(item)"
            :aria-label="item.label"
            type="button"
            @click.stop="toggleExpanded(item.id)"
          >
            <ChevronRight
              class="size-3.5 transition-transform"
              :class="isExpanded(item) ? 'rotate-90' : ''"
              :stroke-width="1.75"
            />
          </button>
        </div>

        <template v-if="hasChildren(item) && isExpanded(item)">
          <button
            v-for="child in item.children"
            :key="child.id"
            :class="[
              'grid h-8 w-full grid-cols-[0.25rem_1rem_minmax(0,1fr)_auto] items-center gap-x-1 rounded-lg pr-2 text-left text-body font-normal outline-hidden transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50',
              activeId === child.id ? 'text-foreground' : 'text-muted-foreground',
            ]"
            :aria-current="activeId === child.id ? 'page' : undefined"
            :disabled="child.disabled"
            type="button"
            @click="emit('update:activeId', child.id)"
          >
            <span
              class="h-4 w-0.5 justify-self-center rounded-full"
              :class="activeId === child.id ? 'bg-muted-foreground' : 'bg-transparent'"
            />
            <span aria-hidden="true" />
            <span class="ml-1 min-w-0 truncate select-none">
              {{ child.label }}
            </span>
          </button>
        </template>
      </template>
    </nav>
  </aside>
</template>
```

要点:父行是 `relative` 容器 + 绝对定位 chevron 按钮(避免 button 嵌套的非法 HTML);子行沿用四列网格但第二列留空、`h-8`,标签与父项标签左对齐形成视觉缩进。

- [ ] **Step 2: 验证**

Run: `pnpm --filter @oh-my-github/client typecheck && pnpm --filter @oh-my-github/client test`
Expected: 均通过(现有调用方不传 children,行为不变)。

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/renderer/components/navigation/section-sidebar.vue
git commit -m "feat(navigation): support collapsible child items in SectionSidebar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: RepositoryTabId 拆分 5 个 settings id + URL 二级路由

**Files:**
- Modify: `packages/client/src/renderer/pages/workspace/types.ts:5-17`(RepositoryTabId)、`:57-75`(WorkspaceTab)、`:84-106`(WorkspaceBookmark)
- Modify: `packages/client/src/renderer/pages/workspace/workspace-url.ts`
- Modify: `packages/client/src/renderer/pages/workspace/workspace-github-url.ts:55-58`
- Modify: `packages/client/src/renderer/pages/workspace/composables/use-workspace-bookmarks.ts:128,437`
- Modify: `packages/client/src/renderer/pages/repository/repository-page.vue:80`(临时改 id,Task 5 再完整接线)
- Modify: `packages/client/src/renderer/pages/repository/components/repository-section-counts.test.ts:33`
- Test: `packages/client/src/renderer/pages/workspace/workspace-url.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `RepositoryTabId` 移除 `'settings'`,新增 `'settingsGeneral' | 'settingsAccess' | 'settingsAutomation' | 'settingsSecurity' | 'settingsIntegrations'`
  - `WorkspaceTab` / `WorkspaceBookmark` 新增 `repositorySettingsSub?: string`
  - `createRepositoryWorkspaceUrl(owner: string, repo: string, section?: RepositoryTabId, settingsSub?: string): string`
  - 新导出 `sanitizeRepositorySettingsSub(section: RepositoryTabId, value: string | undefined): string | undefined` 与 `REPOSITORY_SETTINGS_SUBPAGES: Partial<Record<RepositoryTabId, readonly string[]>>`(后续阶段的页内 tab 会用)
  - URL token:`tab=settings-general|settings-access|settings-automation|settings-security|settings-integrations`,旧 `tab=settings` 归一化为 `settings-general`

- [ ] **Step 1: 写失败测试**

在 `workspace-url.test.ts` 顶部 import 里补 `createRepositoryWorkspaceUrl`,文件末尾追加:

```ts
describe('repository settings workspace URLs', () => {
  it('normalizes the legacy settings tab token to settings-general', () => {
    expect(normalizeWorkspaceUrl('/octo-org/hello-world?tab=settings'))
      .toBe('/octo-org/hello-world?tab=settings-general')
    expect(createWorkspaceTabFromUrl('/octo-org/hello-world?tab=settings'))
      .toMatchObject({ type: 'repo', repositorySection: 'settingsGeneral' })
  })

  it('round-trips settings category tabs', () => {
    expect(createRepositoryWorkspaceUrl('octo-org', 'hello-world', 'settingsAutomation'))
      .toBe('/octo-org/hello-world?tab=settings-automation')
    expect(createWorkspaceTabFromUrl('/octo-org/hello-world?tab=settings-security'))
      .toMatchObject({ type: 'repo', repositorySection: 'settingsSecurity' })
  })

  it('keeps a valid non-default settings sub page in the query string', () => {
    expect(createRepositoryWorkspaceUrl('octo-org', 'hello-world', 'settingsAutomation', 'webhooks'))
      .toBe('/octo-org/hello-world?tab=settings-automation&sub=webhooks')
    expect(createWorkspaceTabFromUrl('/octo-org/hello-world?tab=settings-automation&sub=webhooks'))
      .toMatchObject({ repositorySection: 'settingsAutomation', repositorySettingsSub: 'webhooks' })
  })

  it('drops invalid, default-first, or misplaced sub pages', () => {
    expect(normalizeWorkspaceUrl('/octo-org/hello-world?tab=settings-automation&sub=nope'))
      .toBe('/octo-org/hello-world?tab=settings-automation')
    expect(normalizeWorkspaceUrl('/octo-org/hello-world?tab=settings-automation&sub=branches'))
      .toBe('/octo-org/hello-world?tab=settings-automation')
    expect(normalizeWorkspaceUrl('/octo-org/hello-world?tab=commits&sub=webhooks'))
      .toBe('/octo-org/hello-world?tab=commits')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @oh-my-github/client exec vitest run src/renderer/pages/workspace/workspace-url.test.ts`
Expected: FAIL(`settings-general` 未知 token 回落 overview;`createRepositoryWorkspaceUrl` 不接受第 4 参)。

- [ ] **Step 3: 改 `types.ts`**

`RepositoryTabId` 中 `| 'settings'` 替换为:

```ts
  | 'settingsGeneral'
  | 'settingsAccess'
  | 'settingsAutomation'
  | 'settingsSecurity'
  | 'settingsIntegrations'
```

`WorkspaceTab` 和 `WorkspaceBookmark` 中 `repositorySection?: RepositoryTabId` 之后各加一行:

```ts
  repositorySettingsSub?: string
```

- [ ] **Step 4: 改 `workspace-url.ts`**

(a) `sanitizeRepositorySection` 中 `if (value === 'settings') return 'settings'` 替换为:

```ts
  if (value === 'settings' || value === 'settings-general') return 'settingsGeneral'
  if (value === 'settings-access') return 'settingsAccess'
  if (value === 'settings-automation') return 'settingsAutomation'
  if (value === 'settings-security') return 'settingsSecurity'
  if (value === 'settings-integrations') return 'settingsIntegrations'
```

(b) `repositorySectionToQuery` 整体替换为:

```ts
const REPOSITORY_SECTION_QUERY_TOKENS: Partial<Record<RepositoryTabId, string>> = {
  pullRequests: 'pull-requests',
  settingsGeneral: 'settings-general',
  settingsAccess: 'settings-access',
  settingsAutomation: 'settings-automation',
  settingsSecurity: 'settings-security',
  settingsIntegrations: 'settings-integrations',
}

function repositorySectionToQuery(section: RepositoryTabId): string {
  return REPOSITORY_SECTION_QUERY_TOKENS[section] ?? section
}
```

(c) 文件顶部常量区(`DEFAULT_ISSUE_CATEGORY` 之后)加:

```ts
export const REPOSITORY_SETTINGS_SUBPAGES: Partial<Record<RepositoryTabId, readonly string[]>> = {
  settingsAccess: ['collaborators', 'teams', 'moderation'],
  settingsAutomation: [
    'branches',
    'rules',
    'actions',
    'runners',
    'webhooks',
    'environments',
    'pages',
    'custom-properties',
  ],
  settingsSecurity: ['advanced-security', 'deploy-keys', 'secrets'],
  settingsIntegrations: ['autolinks'],
}

export function sanitizeRepositorySettingsSub(
  section: RepositoryTabId,
  value: string | undefined,
): string | undefined {
  if (!value) return undefined

  const subpages = REPOSITORY_SETTINGS_SUBPAGES[section]
  if (!subpages) return undefined

  return subpages.includes(value) && value !== subpages[0] ? value : undefined
}
```

(每个分类第一个 sub 是默认页,URL 里省略;General 无 sub。)

(d) `createRepositoryUrlFromPath` 替换为:

```ts
function createRepositoryUrlFromPath(path: string, rawSection: string, rawSub?: string): string {
  const repositorySection = sanitizeRepositorySection(rawSection)

  if (repositorySection === DEFAULT_REPOSITORY_SECTION) {
    return path
  }

  const params = new URLSearchParams()
  params.set('tab', repositorySectionToQuery(repositorySection))

  const settingsSub = sanitizeRepositorySettingsSub(repositorySection, rawSub ?? undefined)
  if (settingsSub) {
    params.set('sub', settingsSub)
  }

  return `${path}?${params.toString()}`
}
```

(e) 两处调用点传入 sub:`routeToWorkspaceUrl` 中改为

```ts
    return createRepositoryUrlFromPath(
      path,
      typeof route.query.tab === 'string' ? route.query.tab : '',
      typeof route.query.sub === 'string' ? route.query.sub : undefined,
    )
```

`normalizeWorkspaceUrl` 中改为

```ts
    return createRepositoryUrlFromPath(path, search.get('tab') ?? '', search.get('sub') ?? undefined)
```

(f) `createRepositoryWorkspaceUrl` 替换为:

```ts
export function createRepositoryWorkspaceUrl(
  owner: string,
  repo: string,
  section: RepositoryTabId = DEFAULT_REPOSITORY_SECTION,
  settingsSub?: string,
): string {
  const path = `/${sanitizeSegment(owner)}/${sanitizeSegment(repo)}`
  return createRepositoryUrlFromPath(path, repositorySectionToQuery(section), settingsSub)
}
```

(g) `parseWorkspaceUrl` 的 repo 分支(`if (owner && repo) {` 处)替换为:

```ts
  if (owner && repo) {
    const repositorySection = sanitizeRepositorySection(query.get('tab') ?? '')
    const repositorySettingsSub = sanitizeRepositorySettingsSub(repositorySection, query.get('sub') ?? undefined)

    return {
      url: createRepositoryWorkspaceUrl(owner, repo, repositorySection, repositorySettingsSub),
      type: 'repo',
      owner,
      repo,
      repositorySection,
      repositorySettingsSub,
    }
  }
```

- [ ] **Step 5: 修其余编译点**

- `workspace-github-url.ts` 中 `if (tab.repositorySection === 'settings') return `${baseUrl}/settings`` 替换为:

```ts
  if (tab.repositorySection?.startsWith('settings')) return `${baseUrl}/settings`
```

- `use-workspace-bookmarks.ts` 两处 `repositorySection: tab.repositorySection,`(约 128 行与 437 行)之后各加一行:

```ts
    repositorySettingsSub: tab.repositorySettingsSub,
```

- `repository-page.vue:80` `{ id: 'settings', icon: Settings },` 临时改为 `{ id: 'settingsGeneral', icon: Settings },`(标签会显示缺失 key,Task 5 完整接线时移除此项)。
- `repository-section-counts.test.ts:33` `createRepositorySectionCountLabel('settings', counts)` 改为 `createRepositorySectionCountLabel('settingsGeneral', counts)`。

注:`components/github/github-reference.ts` 生成的 `?tab=settings` 会被 (a) 的 legacy 归一化兜住,无需改动。

- [ ] **Step 6: 跑测试与 typecheck**

Run: `pnpm --filter @oh-my-github/client test && pnpm --filter @oh-my-github/client typecheck`
Expected: 全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/renderer/pages/workspace packages/client/src/renderer/pages/repository
git commit -m "feat(workspace): split repository settings tab into five category ids with sub routing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: overview 透出 viewerCanAdminister

**Files:**
- Modify: `packages/api/src/types.ts:339-363`(GitHubRepositoryOverview)
- Modify: `packages/api/src/modules/repositories.ts:56-85`(RepositoryResponse)、`:451-475`(getOverview 返回)
- Test: `packages/api/src/modules/repositories.overview.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `GitHubRepositoryOverview.viewerCanAdminister: boolean`(REST `GET /repos/{owner}/{repo}` 的 `permissions.admin`,未认证/字段缺失时为 `false`)

- [ ] **Step 1: 写失败测试**

`repositories.overview.test.ts` 的 describe 内追加:

```ts
  it('reports whether the viewer can administer the repository', async () => {
    const { api } = createApi()

    const overview = await api.getOverview({
      owner: 'octo-org',
      repo: 'hello-world',
    })

    expect(overview.viewerCanAdminister).toBe(true)
  })
```

同文件 `createApi` 的 `GET /repos/{owner}/{repo}` mock data 里(如 `default_branch: 'main',` 之后)加:

```ts
          permissions: { admin: true, push: true, pull: true },
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @oh-my-github/api exec vitest run src/modules/repositories.overview.test.ts`
Expected: FAIL — `viewerCanAdminister` 为 `undefined`。

- [ ] **Step 3: 实现**

- `types.ts` 的 `GitHubRepositoryOverview` 中 `isTemplate: boolean` 之后加:

```ts
  viewerCanAdminister: boolean
```

- `repositories.ts` 的 `RepositoryResponse` 中 `is_template?: boolean` 之后加:

```ts
  permissions?: { admin?: boolean } | null
```

- `getOverview` 返回对象中 `isTemplate: Boolean(repository.is_template),` 之后加:

```ts
      viewerCanAdminister: Boolean(repository.permissions?.admin),
```

- [ ] **Step 4: 跑测试**

Run: `pnpm --filter @oh-my-github/api test && pnpm --filter @oh-my-github/api typecheck && pnpm --filter @oh-my-github/client typecheck`
Expected: 全部 PASS(client 侧只是新增字段,无消费方破坏)。

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/types.ts packages/api/src/modules/repositories.ts packages/api/src/modules/repositories.overview.test.ts
git commit -m "feat(api): expose viewerCanAdminister on repository overview

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Settings 分类页壳 + 外链数据 + i18n

**Files:**
- Modify: `packages/client/src/renderer/pages/repository/components/types.ts`
- Create: `packages/client/src/renderer/pages/repository/components/settings/settings-links.ts`
- Create: `packages/client/src/renderer/pages/repository/components/settings/section.vue`
- Modify: `packages/client/src/renderer/i18n/locales/en.json`、`zh.json`(repository.sections 5 个新 key + repository.settings 块)

**Interfaces:**
- Consumes: Task 2 的 `RepositoryTabId` settings id
- Produces:
  - `REPOSITORY_SETTINGS_SECTION_IDS: readonly RepositorySettingsSectionId[]`、`type RepositorySettingsSectionId`、`isRepositorySettingsSection(id: RepositoryTabId): id is RepositorySettingsSectionId`、`REPOSITORY_SETTINGS_PARENT_ID = 'settings'`(均自 `repository/components/types.ts`)
  - `settings/section.vue`,props:`{ category: RepositorySettingsSectionId; owner: string; repo: string }`

- [ ] **Step 1: 扩展 `repository/components/types.ts`**

文件末尾追加:

```ts
export const REPOSITORY_SETTINGS_SECTION_IDS = [
  'settingsGeneral',
  'settingsAccess',
  'settingsAutomation',
  'settingsSecurity',
  'settingsIntegrations',
] as const

export type RepositorySettingsSectionId = (typeof REPOSITORY_SETTINGS_SECTION_IDS)[number]

export const REPOSITORY_SETTINGS_PARENT_ID = 'settings'

export function isRepositorySettingsSection(id: RepositoryTabId): id is RepositorySettingsSectionId {
  return (REPOSITORY_SETTINGS_SECTION_IDS as readonly RepositoryTabId[]).includes(id)
}
```

并把文件顶部 `import type { RepositoryTabId } from '@/pages/workspace/types'` 保持不变(已存在)。

- [ ] **Step 2: 创建 `settings/settings-links.ts`**

```ts
import type { RepositorySettingsSectionId } from '../types'

export interface RepositorySettingsLink {
  id: string
  labelKey: string
  path: string
}

export const repositorySettingsLinks: Record<RepositorySettingsSectionId, readonly RepositorySettingsLink[]> = {
  settingsGeneral: [
    { id: 'general', labelKey: 'repository.settings.links.general', path: '' },
  ],
  settingsAccess: [
    { id: 'collaborators', labelKey: 'repository.settings.links.collaborators', path: '/access' },
    { id: 'interactionLimits', labelKey: 'repository.settings.links.interactionLimits', path: '/interaction_limits' },
    { id: 'reviewLimits', labelKey: 'repository.settings.links.reviewLimits', path: '/review_limits' },
    { id: 'reportedContent', labelKey: 'repository.settings.links.reportedContent', path: '/reported_content' },
  ],
  settingsAutomation: [
    { id: 'branches', labelKey: 'repository.settings.links.branches', path: '/branches' },
    { id: 'rules', labelKey: 'repository.settings.links.rules', path: '/rules' },
    { id: 'actions', labelKey: 'repository.settings.links.actions', path: '/actions' },
    { id: 'runners', labelKey: 'repository.settings.links.runners', path: '/actions/runners' },
    { id: 'webhooks', labelKey: 'repository.settings.links.webhooks', path: '/hooks' },
    { id: 'environments', labelKey: 'repository.settings.links.environments', path: '/environments' },
    { id: 'codespaces', labelKey: 'repository.settings.links.codespaces', path: '/codespaces' },
    { id: 'copilot', labelKey: 'repository.settings.links.copilot', path: '/copilot/code_review' },
    { id: 'pages', labelKey: 'repository.settings.links.pages', path: '/pages' },
    { id: 'customProperties', labelKey: 'repository.settings.links.customProperties', path: '/custom-properties' },
  ],
  settingsSecurity: [
    { id: 'advancedSecurity', labelKey: 'repository.settings.links.advancedSecurity', path: '/security_analysis' },
    { id: 'deployKeys', labelKey: 'repository.settings.links.deployKeys', path: '/keys' },
    { id: 'secretsActions', labelKey: 'repository.settings.links.secretsActions', path: '/secrets/actions' },
    { id: 'secretsCodespaces', labelKey: 'repository.settings.links.secretsCodespaces', path: '/secrets/codespaces' },
    { id: 'secretsDependabot', labelKey: 'repository.settings.links.secretsDependabot', path: '/secrets/dependabot' },
  ],
  settingsIntegrations: [
    { id: 'githubApps', labelKey: 'repository.settings.links.githubApps', path: '/installations' },
    { id: 'emailNotifications', labelKey: 'repository.settings.links.emailNotifications', path: '/notifications' },
    { id: 'autolinks', labelKey: 'repository.settings.links.autolinks', path: '/key_links' },
  ],
}
```

- [ ] **Step 3: 创建 `settings/section.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink } from 'lucide-vue-next'
import type { RepositorySettingsSectionId } from '../types'
import { repositorySettingsLinks } from './settings-links'

const props = defineProps<{
  category: RepositorySettingsSectionId
  owner: string
  repo: string
}>()

const { t } = useI18n()

const links = computed(() => repositorySettingsLinks[props.category])

function openLink(path: string): void {
  const url = `https://github.com/${encodeURIComponent(props.owner)}/${encodeURIComponent(props.repo)}/settings${path}`
  void window.ohMyGithub?.links?.openExternalUrl(url)
}
</script>

<template>
  <section class="grid gap-3">
    <p class="text-body text-muted-foreground">
      {{ t('repository.settings.externalHint') }}
    </p>

    <div class="overflow-hidden rounded-xl border border-border bg-card">
      <button
        v-for="(link, index) in links"
        :key="link.id"
        :class="[
          'flex h-11 w-full items-center justify-between px-4 text-left text-body text-foreground outline-hidden transition-colors hover:bg-muted/70 focus-visible:bg-muted/70',
          index > 0 ? 'border-t border-border' : '',
        ]"
        type="button"
        @click="openLink(link.path)"
      >
        <span class="min-w-0 truncate">{{ t(link.labelKey) }}</span>
        <ExternalLink
          class="size-3.5 shrink-0 text-muted-foreground"
          :stroke-width="1.75"
        />
      </button>
    </div>
  </section>
</template>
```

- [ ] **Step 4: i18n**

`en.json` 的 `repository.sections` 里保留 `"settings": { "title": "Settings" }`(父项标签),并新增:

```json
"settingsGeneral": { "title": "General" },
"settingsAccess": { "title": "Access" },
"settingsAutomation": { "title": "Code & automation" },
"settingsSecurity": { "title": "Security" },
"settingsIntegrations": { "title": "Integrations" }
```

`en.json` 的 `repository` 下新增 `settings` 块:

```json
"settings": {
  "externalHint": "These settings aren't available in-app yet. Each entry opens the matching GitHub settings page in your browser.",
  "links": {
    "general": "General",
    "collaborators": "Collaborators and teams",
    "interactionLimits": "Interaction limits",
    "reviewLimits": "Code review limits",
    "reportedContent": "Reported content",
    "branches": "Branches",
    "rules": "Rulesets",
    "actions": "Actions",
    "runners": "Runners",
    "webhooks": "Webhooks",
    "environments": "Environments",
    "codespaces": "Codespaces",
    "copilot": "Copilot code review",
    "pages": "Pages",
    "customProperties": "Custom properties",
    "advancedSecurity": "Advanced Security",
    "deployKeys": "Deploy keys",
    "secretsActions": "Actions secrets and variables",
    "secretsCodespaces": "Codespaces secrets",
    "secretsDependabot": "Dependabot secrets",
    "githubApps": "GitHub Apps",
    "emailNotifications": "Email notifications",
    "autolinks": "Autolink references"
  }
}
```

`zh.json` 对应位置(`repository.sections` 保留 `"settings": { "title": "设置" }`)新增:

```json
"settingsGeneral": { "title": "常规" },
"settingsAccess": { "title": "访问权限" },
"settingsAutomation": { "title": "代码与自动化" },
"settingsSecurity": { "title": "安全" },
"settingsIntegrations": { "title": "集成" }
```

```json
"settings": {
  "externalHint": "以下设置暂未内置,点击条目将在浏览器中打开 GitHub 对应设置页。",
  "links": {
    "general": "常规",
    "collaborators": "协作者与团队",
    "interactionLimits": "互动限制",
    "reviewLimits": "代码审查限制",
    "reportedContent": "被举报内容",
    "branches": "分支保护",
    "rules": "规则集",
    "actions": "Actions",
    "runners": "Runners",
    "webhooks": "Webhooks",
    "environments": "环境",
    "codespaces": "Codespaces",
    "copilot": "Copilot 代码审查",
    "pages": "Pages",
    "customProperties": "自定义属性",
    "advancedSecurity": "高级安全",
    "deployKeys": "部署密钥",
    "secretsActions": "Actions 密钥与变量",
    "secretsCodespaces": "Codespaces 密钥",
    "secretsDependabot": "Dependabot 密钥",
    "githubApps": "GitHub Apps",
    "emailNotifications": "邮件通知",
    "autolinks": "自动链接引用"
  }
}
```

- [ ] **Step 5: 验证**

Run: `pnpm --filter @oh-my-github/client test && pnpm --filter @oh-my-github/client typecheck`
Expected: PASS(locales.test.ts 会编译校验所有新 key;section.vue 尚未被引用,仅参与 typecheck)。

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/renderer/pages/repository/components packages/client/src/renderer/i18n
git commit -m "feat(repository): add settings category shells with external links and i18n

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: repository-page / repository-sidebar 接线 + 权限门控

**Files:**
- Modify: `packages/client/src/renderer/pages/repository/components/repository-sidebar.vue`
- Modify: `packages/client/src/renderer/pages/repository/repository-page.vue`

**Interfaces:**
- Consumes: Task 1 的 `SectionSidebarItem.children/defaultExpanded`;Task 3 的 `overview.viewerCanAdminister`;Task 4 的 `REPOSITORY_SETTINGS_SECTION_IDS`、`REPOSITORY_SETTINGS_PARENT_ID`、`isRepositorySettingsSection`、`settings/section.vue`
- Produces: `RepositorySidebar` 新增 prop `showSettings: boolean`;Settings 父项(id `'settings'`,默认展开,5 个子项);点父项映射到 `settingsGeneral`

- [ ] **Step 1: 改 `repository-sidebar.vue`**

- lucide import 行加 `Settings`:`import { BellOff, Eye, GitFork, Settings, Star } from 'lucide-vue-next'`
- `import SectionSidebar from '@/components/navigation/section-sidebar.vue'` 下方加类型导入,并引入常量:

```ts
import type { SectionSidebarItem } from '@/components/navigation/section-sidebar.vue'
import {
  REPOSITORY_SETTINGS_PARENT_ID,
  REPOSITORY_SETTINGS_SECTION_IDS,
} from './types'
```

- props 里 `sections: readonly RepositorySection[]` 之后加:

```ts
  showSettings: boolean
```

- `sidebarItems` computed 替换为:

```ts
const sidebarItems = computed<SectionSidebarItem[]>(() => {
  const items: SectionSidebarItem[] = props.sections.map((section) => ({
    id: section.id,
    countLabel: createRepositorySectionCountLabel(section.id, props.repositoryCounts),
    icon: section.icon,
    label: t(`repository.sections.${section.id}.title`),
  }))

  if (props.showSettings) {
    items.push({
      id: REPOSITORY_SETTINGS_PARENT_ID,
      icon: Settings,
      label: t('repository.sections.settings.title'),
      defaultExpanded: true,
      children: REPOSITORY_SETTINGS_SECTION_IDS.map((id) => ({
        id,
        label: t(`repository.sections.${id}.title`),
      })),
    })
  }

  return items
})
```

- `updateActiveSection` 替换为:

```ts
function updateActiveSection(id: string): void {
  if (id === REPOSITORY_SETTINGS_PARENT_ID) {
    emit('update:activeSection', 'settingsGeneral')
    return
  }

  emit('update:activeSection', id as RepositorySectionId)
}
```

- [ ] **Step 2: 改 `repository-page.vue`**

- 移除 Task 2 的临时项:`repositorySections` 数组删掉 `{ id: 'settingsGeneral', icon: Settings },`(数组回到 11 个常规 section;`Settings` icon import 从本文件删除,已挪到 sidebar)。
- import 区加:

```ts
import SettingsSection from './components/settings/section.vue'
import { isRepositorySettingsSection } from './components/types'
```

- `isOverviewLoading` 附近加:

```ts
const canAdministerRepository = computed(() => overview.value?.viewerCanAdminister ?? false)
```

- 模板 `<RepositorySidebar>` 上加 prop:

```html
      :show-settings="canAdministerRepository"
```

- 模板 `DeploymentsSection` 块之后、`<Empty v-else ...>` 之前插入:

```html
        <SettingsSection
          v-else-if="isRepositorySettingsSection(activeSection)"
          :category="activeSection"
          :owner="owner"
          :repo="repository"
        />
```

- [ ] **Step 3: 验证**

Run: `pnpm --filter @oh-my-github/client test && pnpm --filter @oh-my-github/client typecheck`
Expected: 全部 PASS。

手工验证(用户侧 HMR 已在跑,打开一个自己 admin 的仓库):
1. Sidebar 出现 Settings 父项,默认展开,5 个子项(常规/访问权限/代码与自动化/安全/集成)。
2. 点 chevron 收起再展开,不影响当前页面;点父项跳到 General。
3. 点「代码与自动化」,内容区为外链列表;点任意行在浏览器打开对应 GitHub settings 页。
4. URL 含 `?tab=settings-automation`;复制 URL 新 tab 打开能还原。
5. 打开一个无 admin 权限的仓库(如任意大型开源库),Sidebar 无 Settings。

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/renderer/pages/repository
git commit -m "feat(repository): wire settings sidebar group with admin gating and category shells

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review 结论(已执行)

- **Spec 覆盖**:本计划只覆盖 spec Part 7 的第 1 步(骨架)。Part 1(sidebar)→ Task 1;Part 2(路由/权限)→ Task 2/3/5;分类页壳与外链 → Task 4。spec 其余部分(General、Access、Automation、Security、Integrations 的原生实现)属于后续 5 份计划,不在本计划范围。
- **占位符扫描**:无 TBD/TODO;所有步骤含完整代码或精确 diff 描述。
- **类型一致性**:`RepositorySettingsSectionId`(Task 4 定义)与 Task 2 的 5 个 `RepositoryTabId` 字面量一致;`REPOSITORY_SETTINGS_PARENT_ID='settings'` 仅作 sidebar item id,不进入 `RepositoryTabId`;`createRepositoryWorkspaceUrl` 第 4 参在 Task 2 定义、Task 5 尚未使用(sub 消费在后续阶段)。
- **已知取舍**:非 admin 用户直接通过 URL 进入 settings tab 时会看到外链壳(导航已隐藏,内容无害);后续阶段接原生内容时由接口 403 错误态兜底。
