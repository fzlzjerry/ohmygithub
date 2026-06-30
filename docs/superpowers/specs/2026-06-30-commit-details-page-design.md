# Commit Details 页面 — 设计文档

- 日期：2026-06-30
- 范围：实现单个 commit 的 details 页面，并顺带产出三个可复用基础件：共享 FileTree 组件、ShikiCode 的 diff 渲染能力、right panel 的 `diff` 预览类型。
- 依赖：建立在已合入工作树的 commits-section 之上（commits-section 行的 `openCommit` 预留钩子是本特性的入口）。

## 1. 目标与决策

- 点击 commits 列表中的一条提交 → 打开一个独立的 **commit details tab**，展示：标题 + commit 信息 + 只含「更改文件」的 Files 树；点击文件在 **right panel** 看该文件的 diff。
- **diff 渲染**：语法高亮 + 增删底色（解析 GitHub patch，用文件真实语言做 shiki 语法高亮，再叠加绿/红行底色与 `+/-` gutter）。用 shiki 官方 `codeToHast` + 行 transformer 实现。
- **Files 呈现**：按目录树（复用抽取出的共享 FileTree），每项右侧显示绿 `+n` / 红 `−n`，默认展开。
- **right panel diff**：单栏（unified），不做 GitHub 的双栏。
- commit 信息卡包含 verification 徽章和 message body；页面上不内联 diff（点击文件只在 right panel 看，和现有 Files section 行为一致）。
- 整个特性放一个 spec。

## 2. 架构总览

全程沿用既有模式。新增 `commit` workspace tab，完全仿照已存在的 `action-run` detail tab 链路：

```
新 WorkspaceTabType 'commit'
  -> workspace-url.ts 解析 /:owner/:repo/commit/:sha
  -> workspace-panel.vue 增加 tab.type === 'commit' 分支
  -> pages/commit/commit-page.vue
```

数据走与 commits-section 相同的纵向链路：

```
api/modules/repositories.ts (getCommit)
  -> client.ts + mock.ts
  -> main/repositories.ts (IPC: repositories:get-commit)
  -> preload/index.ts (bridge)
  -> renderer/env.d.ts (全局类型)
  -> composables/github/use-repositories.ts (useRepositoryCommitQuery)
  -> commit 页面 + Files 组件
```

三个可复用基础件先建好，commit 页面作为消费者验证它们。

## 3. 共享 FileTree 组件

把现有 `pages/repository/components/files/file-tree-item.vue` 抽到共享位置 `components/file-tree/`：

- `file-tree.vue`：包装组件（`<ul>` + 渲染顶层节点 + 空态），从 `components/index.ts` 导出为 `FileTree`。
- `file-tree-item.vue`：递归项（移动 + 增强）。
- Props：`items: GitHubRepositoryFileNode[]`、`selectedPath: string | null`、`expandedPaths: Set<string>`；Emit：`select`、`toggle`。
- **新增可选 per-node 统计**：节点可带可选 `additions?: number`、`deletions?: number`；存在时在行右侧渲染绿 `+n` / 红 `−n`（等宽、`tabular-nums`）。无统计（repo files 浏览）时不渲染统计列。
- `pages/repository/components/files/files-panel.vue` 改为复用 `FileTree`（不传统计），保持现有浏览行为不变。
- commit 的 Files 组件复用 `FileTree`（传统计、默认展开全部目录）。

> 统计字段挂在 `GitHubRepositoryFileNode` 上为可选项，避免影响 repo files 浏览路径。

## 4. ShikiCode diff 能力（语法高亮 + 增删底色）

- 新增 `components/code/parse-diff.ts`：把 GitHub unified patch 解析为结构化行：
  - 行类型：`add` / `del` / `context` / `hunk`（hunk header `@@ ... @@`）。
  - 每行还原去掉 `+/-` 前缀后的纯代码文本，用于语法高亮。
  - 输出含新旧行号信息（供 gutter 显示，可选）。
- 升级 diff 渲染（`ShikiDiff` 作为入口薄封装，内部改造；`ShikiCode` 获得 diff 能力）：
  - 用 shiki 官方 `codeToHast` 对「纯代码」按文件真实语言（由 filename 推断，复用 `code-language.ts`）做语法高亮。
  - 配一个**行 transformer**：按行序给 `add`/`del` 行加 class（绿/红底色 + 左侧 `+`/`−` gutter），`hunk` 行单独样式。
  - 双主题：沿用现有 light/dark（`useShikiHighlighter` 的 themes）。
  - 失败回退：退回现有 `language="diff"` 的着色渲染。
- ShikiCode 的 diff 模式入参：patch（unified 文本）+ filename/language；非 diff 路径保持现状不变。

## 5. Right panel `diff` 预览类型（单栏）

- `composables/use-right-panel.ts` 的 `RightPanelContent` 联合新增一支：
  ```ts
  | {
      type: 'diff'
      patch: string
      filename: string
      language?: string
      additions?: number
      deletions?: number
      title?: string
    }
  ```
- `workspace-right-panel.vue` 增加 `v-else-if content.type === 'diff'` 分支，单栏 unified 渲染 ShikiCode diff（带 `themed-background`），顶部可显示 filename 与 `+a −d`。

## 6. Commit 数据层

- api `getCommit(options: RepositoryCommitOptions)`：`GET /repos/{owner}/{repo}/commits/{ref}`，映射为 `GitHubCommitDetail`：
  - `sha` / `shortSha` / `headline`(message 首行) / `message`(完整) / `htmlUrl`
  - `author` { login, name, avatarUrl, date }、`committer` { 同上 }
  - `parents: { sha: string; shortSha: string }[]`
  - `verification?: { verified: boolean; reason?: string }`
  - `stats: { additions: number; deletions: number; total: number }`
  - `files: GitHubCommitFile[]`，其中 `GitHubCommitFile`：`{ filename, previousFilename?, status: 'added'|'modified'|'removed'|'renamed'|'changed', additions, deletions, patch? }`
- `RepositoryCommitOptions extends RepositoryOptions { sha: string }`；在 `GitHubClient` 接口增加 `getRepositoryCommit`。
- 配套：
  - `client.ts` 接线、`mock.ts` 实现（返回含少量 file/patch 的示例）。
  - `main/repositories.ts`：`repositories:get-commit` handler。
  - `preload/index.ts`：`getCommit(owner, repo, sha)`。
  - `env.d.ts`：全局类型 `GitHubCommitDetail` / `GitHubCommitFile` + bridge 签名。
  - `use-repositories.ts`：`useRepositoryCommitQuery(owner, repo, sha, enabled)`。

## 7. Commit details 页面

- 新 tab 类型 `commit`：
  - `WorkspaceTabType` 增加 `'commit'`；`WorkspaceTab` 增加 `commitSha?: string`。
  - `workspace-url.ts`：解析 `/:owner/:repo/commit/:sha`（sha 为 hex 字符串 segment，非 number），生成 `{ type:'commit', owner, repo, commitSha }`；并补 tab 标题/标识逻辑。
  - `workspace-panel.vue`：`import CommitPage`，新增 `v-else-if tab.type === 'commit'` 分支。
- 页面 `pages/commit/commit-page.vue`（单页滚动）：
  - **标题**：commit headline。
  - **commit 信息卡**：作者头像 + login、authored 日期（committer 不同则也显示）、短 SHA + 复制按钮、parent SHA、verification 徽章、stats 摘要 `N files changed +X −Y`、Open on GitHub；message body（若有，按等宽/预格式展示）。
  - **Files 组件**（`pages/commit/components/commit-files.vue`）：把 `files[]` 构建成「只含更改文件」的目录树（每节点带 `additions/deletions`），喂给共享 `FileTree`，默认展开。点击文件 → `openRightPanel({ type:'diff', patch, filename, language, additions, deletions })`；无 patch（二进制/过大）→ right panel 显示「无可用 diff」提示（download/notice 风格）。
- right panel 是 workspace 级单例（`useRightPanel`），commit 页面与其它页面共用同一个面板。

## 8. 接线

commits-section 的 `section.vue` 中 `openCommit(commit)` 由空操作改为：
```ts
void router.push(`/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commit/${encodeURIComponent(commit.sha)}`)
```

## 9. 边界情况

- 文件 status：added / removed / modified / renamed（renamed 显示 `previousFilename → filename`）。
- 无 patch（二进制、超大、纯重命名）：Files 项照常显示统计，right panel 给「无可用 diff」提示。
- GitHub `commits/{sha}` 的 files 上限 300：按返回值渲染，不额外翻页。
- 加载/错误/空态：页面与 Files 组件分别有 loading 骨架、error（带重试）、missing identity 态。

## 10. 测试 / 验证

仓库无测试框架（无 vitest/jest）。验证：

- `pnpm typecheck`（api + client 全链路类型）。
- dev 手动冒烟：打开一条 commit → 信息卡正确；Files 树显示更改文件与 `+/-`；点击文件 right panel 出现单栏语法高亮 diff；二进制/重命名/无 patch 文件提示正常；深色模式 diff 配色正确；从 repo files 页面浏览文件（复用后的 FileTree）行为不回归。

## 11. 范围与构建顺序

一个 spec。建议构建顺序（也是任务拆分顺序）：

1. 共享 FileTree 组件（抽取 + 可选 `+/-` 统计 + files-panel 改用）
2. parse-diff 工具 + ShikiCode/ShikiDiff diff 渲染
3. right panel `diff` 预览类型
4. commit 数据层（api → IPC → preload → env.d.ts → composable → mock）
5. commit details 页面（tab 类型 + 路由 + 页面 + Files 组件）
6. 接线 commits-section 的 `openCommit`

## 12. 不在本期范围

- GitHub 风格的双栏 split diff（本期单栏 unified）。
- 页面内联展开 diff（本期只在 right panel 看）。
- commit 评论、diff 评论、文件级评论。
- commit 列表的无限滚动/超 300 文件分页。
- 把其它页面（如 PR）迁移到新的 diff 渲染（本期只做 commit 与 right panel）。
