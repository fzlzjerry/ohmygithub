# New 入口 + New Repo Tab 设计

日期：2026-07-05
状态：已确认

## 背景与调研结论

需求原始诉求是"新建仓库"和"新建组织"两个页面。API 调研结论：

- **新建仓库**：GitHub REST API 完全开放。个人仓库 `POST /user/repos`，组织仓库 `POST /orgs/{org}/repos`，支持 `name` / `description` / `private` / `auto_init` / `gitignore_template` / `license_template` 等参数。classic token 需要 `repo` scope（公开仓库 `public_repo`），fine-grained token 需要 Administration 写权限。
- **新建组织**：github.com 上没有开放 API。唯一的 `POST /admin/organizations` 只存在于 GitHub Enterprise Server 且要求 site admin；GraphQL 侧也只有 Enterprise Cloud 专属 mutation。普通用户只能走网页 `https://github.com/account/organizations/new`。

因此本设计：New Repo 做成应用内完整表单 Tab；New Organization 只做入口，点击跳系统浏览器。

## 1. 侧边栏入口

在 `workspace-sidebar.vue` 的 Inbox 条目下方新增一行 **"New"**（`Plus` 图标，lucide-vue-next），点击弹出下拉菜单（`@oh-my-github/ui` DropdownMenu），两个菜单项：

- **Repository** — 打开 `new-repo` Tab（internal route `/new-repository`）
- **Organization ↗** — 通过系统浏览器打开 `https://github.com/account/organizations/new`，带外链图标，不新建 Tab，不激活侧边栏选中态

"New" 条目本身没有选中态语义；`new-repo` Tab 激活时菜单入口高亮与否遵循 `syncActiveItem()` 的现有匹配逻辑（匹配 `/new-repository` 即高亮 New 条目）。

## 2. 新 Tab 类型 `new-repo`

按 inbox / reviews 这类 internal route 的既有模式接入：

- `pages/workspace/types.ts`：`WorkspaceTabType` union 增加 `'new-repo'`
- `pages/workspace/workspace-url.ts`：
  - `VALID_TYPES`、`INTERNAL_TYPES`、`INTERNAL_PATHS` 增加 `/new-repository`
  - `parseWorkspaceUrl()` 增加分支
  - 新增 `createNewRepoWorkspaceUrl()`
  - `titleForWorkspaceTab()` 增加 case
- `components/workspace-panel.vue`：增加 `v-else-if="tab.type === 'new-repo'"` 渲染 `new-repo-page.vue`
- `tab-presentation.ts`：`getWorkspaceTabView` 增加图标/标题条目

## 3. New Repo 页面（对齐 github.com/new）

新建 `new-repo-page.vue`。表单复用 `settings/components/github/profile-settings.vue` 的模式：`reactive` 表单对象 + `@oh-my-github/ui` 的 `Field` / `Input` / `Select` / `Checkbox` / `Button` / `Spinner` + `useToast`。遵循既有约定：表单不套圆角边框卡片。

字段：

| 字段 | 控件 | 数据来源 / 说明 |
|---|---|---|
| Owner | Select：当前登录用户 + 所属组织 | 组织列表 `GET /user/orgs`（优先复用现有 accounts 方法） |
| Repository name | Input | 前端校验：非空、合法字符（字母数字 `-` `_` `.`）；重名交给 API 422 |
| Description | Input | 可选 |
| Visibility | Public / Private 二选一 | 默认 Public |
| Initialize with README | Checkbox | 映射 `auto_init` |
| .gitignore template | Select，默认 None | `GET /gitignore/templates` |
| License | Select，默认 None | `GET /licenses`（取 key + name） |

模板两个 Select 的数据在页面挂载时加载；加载失败不阻塞表单，降级为仅 None 选项并提示。

提交行为：

- 成功：当前 Tab 原地导航（替换 URL）到新仓库的 repo Tab；刷新仓库列表相关缓存（遵循 detail-page mutation 后刷新 unmounted list cache 的既有约定）
- 422（重名等校验错误）：内联显示在 name 字段下方
- 403（组织禁止成员建仓库）及其他错误：走 `resolveErrorMessage`，toast 展示
- 提交中：按钮 disabled + Spinner

## 4. API 链路

照 `fork()` / `createBranch()` 的既有五层模式：

1. `packages/api/src/modules/repositories.ts`：
   - `createRepository(params)` — owner 为本人时 `POST /user/repos`，为组织时 `POST /orgs/{org}/repos`；参数含 `owner`、`name`、`description`、`private`、`autoInit`、`gitignoreTemplate`、`licenseTemplate`
   - `listGitignoreTemplates()` — `GET /gitignore/templates`
   - `listLicenses()` — `GET /licenses`
2. `packages/api/src/client.ts` 门面 + `types.ts` 类型 + `mock.ts` mock 实现
3. `packages/client/src/main/repositories.ts`：`ipcMain.handle('repositories:create-repository', ...)` 等三个 handler
4. `packages/client/src/preload/index.ts`：暴露 `window.ohMyGithub.repositories.createRepository` 等
5. `packages/client/src/renderer/composables/github/use-repositories.ts`：新增 `createRepository()`、模板列表查询

组织列表若 `AccountsApi` 已有可用方法则复用，否则同链路新增 `GET /user/orgs`。

## 5. i18n

`en.json` / `zh.json` 双份新增：

- `workspace.sidebar.items.new` 及两个菜单项文案
- `newRepo.*` 命名空间：页面标题、各字段 label/placeholder、校验与错误文案、提交按钮

`locales.test.ts` 强制 en/zh 键齐全。

## 6. 测试

- `packages/api`：`createRepository` / 模板列表的 module 测试，照 `repositories.mutations.test.ts` 模式
- `workspace-url` 的 parse/title 若有既有测试则补 `new-repo` case
- locales parity 由既有测试覆盖

## 明确不做（YAGNI）

- 应用内创建组织（无 API）
- repo template（"从模板创建"）、团队授权、issue 模板等 github.com/new 之外的高级项
- name 可用性实时检查（依赖 API 错误反馈即可）
