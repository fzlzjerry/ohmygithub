# 仓库 Settings 标签页 + Sidebar 可折叠子项设计

日期:2026-07-05
状态:待确认

## 目标

1. 为仓库页 Sidebar(`SectionSidebar`)增加通用的「父项 + 可折叠子项」能力,Settings 默认展开。
2. 把空着的 Settings 标签页做成完整的仓库设置中心:镜像 GitHub web 仓库 Settings(`github.com/{owner}/{repo}/settings`)的分组结构,有 API 的做应用内原生交互,无 API 的做 ↗ 跳浏览器外链(与 Settings 窗口 GitHub 账号设置的既有模式一致)。

## 已确认的需求决策

- **范围**:一次全做,覆盖所有有 API 的子页面。
- **Danger Zone**:原生实现(改可见性 / 转移 / 归档 / 删除),仿 GitHub 输入仓库全名确认。
- **权限**:非 admin 隐藏整个 Settings 及子项(GraphQL `viewerCanAdminister` 判断)。
- **复杂规则编辑器**(Branch protection / Rulesets):原生列表 + 只读详情 + 删除/启停;新建和编辑跳网页。
- **Sidebar 子项粒度**:按 GitHub 分组 5 个子项(General / Access / Code & automation / Security / Integrations),页内用既有 `TabSwitcher` 切换具体子页。
- **父项行为**:点 Settings 父项导航到 General 并展开;chevron 单独控制折叠;默认展开。
- **实现方式**:泛化 `SectionSidebar`(方案 A),不特化、不引入第二套折叠组件。

## Part 1 · SectionSidebar 子项机制

`components/navigation/section-sidebar.vue`:

```ts
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
  children?: readonly SectionSidebarChildItem[]   // 新增
  defaultExpanded?: boolean                        // 新增
}
```

- 组件内部 `ref<Set<string>>` 管理展开态,按 `defaultExpanded` 初始化。
- 有 children 的父项行尾渲染 chevron(`ChevronRight`,展开时 rotate 90°);**点 chevron 只切换折叠不导航**;点父项行本身发 `update:activeId(父 id)` 并自动展开。父项与子项 id 必须互不相同(消费方负责把父项 id 映射为默认子页,见 Part 2)。
- **active 判定**:`activeId` 命中某子项时,该子项显示左侧指示条,父项文字保持 foreground(半激活);若此时父项处于折叠态,watch 自动展开。
- 子项行复用父项网格布局但去掉 icon 列、整体左缩进,高度 h-8(父项 h-9),无 icon。
- 能力完全通用,后续 Account 页等可直接复用。

## Part 2 · 路由与 tab id

- `RepositoryTabId`(`pages/workspace/types.ts`)将 `settings` 替换为 5 个值:
  `settingsGeneral | settingsAccess | settingsAutomation | settingsSecurity | settingsIntegrations`。
- URL 解析(`workspace-url.ts`)把旧 `?tab=settings` 归一化为 `settingsGeneral`,兼容旧书签;新 URL 不再产生 `tab=settings`。
- Settings 父项在 sidebar 中用独立 id `settings`(不属于 `RepositoryTabId`),children 为上述 5 个分类 id;repository-page 的 `setActiveSection` 收到 `settings` 时映射为 `settingsGeneral`(点父项 = 进 General),保证父项与 General 子项 id 不冲突。
- 分类页内的具体子页用第二级参数编码:`?tab=settingsAutomation&sub=webhooks`。
  - `WorkspaceTab` / `WorkspaceBookmark` 增加 `repositorySettingsSub?: string`;
  - `createRepositoryWorkspaceUrl(owner, repo, section, settingsSub?)` 增加可选参数;
  - 非法 `sub` 静默回落到该分类第一个子页。
- **权限门控**:`repositories.overview` 的 GraphQL 查询加 `viewerCanAdminister` 字段进 overview 数据;repository-page 的 `repositorySections` 改为 computed,非 admin 过滤掉 Settings 项。overview 未加载完成时同样不显示(避免闪现)。

## Part 3 · Settings 信息架构

每个分类是一个 section 组件(`pages/repository/components/settings/<category>/section.vue`),页内导航用既有 `TabSwitcher`;**无 API 的子页也出现在 TabSwitcher 里,带 ↗ 图标,点击直接 `openExternal` 到对应网页**(与 Settings 窗口模式一致,不切换页内内容)。

### 3.1 General(`settingsGeneral`,无页内 tab,分区堆叠)

| 分区 | 控件 | API |
|---|---|---|
| 基本信息 | 仓库名(改名) | `PATCH /repos/{o}/{r}` `name` |
| | 描述、主页 | `PATCH` `description` / `homepage` |
| | Topics(标签编辑,复用 `tags-input`) | `PUT /repos/{o}/{r}/topics` |
| | Template repository 开关 | `PATCH` `is_template` |
| | Require web commit sign-off 开关 | `PATCH` `web_commit_signoff_required` |
| 默认分支 | 切换默认分支(复用 `github-branch-select`) | `PATCH` `default_branch` |
| | 重命名当前默认分支 | `POST /repos/{o}/{r}/branches/{branch}/rename` |
| Features | Wikis / Issues / Projects 开关 | `PATCH` `has_wiki` / `has_issues` / `has_projects` |
| | Discussions 开关 | **GraphQL** `updateRepository(hasDiscussionsEnabled)`(REST PATCH 无此字段,已核实) |
| | Sponsorships 开关 | **GraphQL** `updateRepository(hasSponsorshipsEnabled)` |
| Pull Requests | 允许 PR / 谁能创建 PR | `PATCH` `has_pull_requests`、`pull_request_creation_policy`(`all`\|`collaborators_only`) |
| | Merge / Squash / Rebase 开关 + squash/merge 默认标题与消息 | `PATCH` `allow_merge_commit` 等 + `squash_merge_commit_title/message`、`merge_commit_title/message` |
| | Always suggest updating PR branches | `PATCH` `allow_update_branch` |
| | Allow auto-merge | `PATCH` `allow_auto_merge` |
| | 合并后自动删除 head 分支 | `PATCH` `delete_branch_on_merge` |
| Releases | Immutable releases 开关 | `GET/PUT/DELETE /repos/{o}/{r}/immutable-releases` |
| Danger Zone | 改可见性(public/private) | `PATCH` `visibility`,**输入全名确认** |
| | 转移仓库(new_owner,可选 new_name) | `POST /repos/{o}/{r}/transfer`,**输入全名确认** |
| | 归档 / 取消归档 | `PATCH` `archived: true/false`,普通确认对话框 |
| | 删除仓库 | `DELETE /repos/{o}/{r}`,**输入全名确认**,需 `delete_repo` scope |
| ↗ 外链 | 社交预览图、Wiki 仅协作者编辑、LFS 归档包含 | `/settings`(General 区顶部一行说明 + 外链) |

改名 / 转移 / 删除的善后:改名成功后用新名字重建 tab URL 并刷新 overview;删除成功后关闭当前内容(导航到 owner 页)并失效 owned-repositories 缓存;转移是异步的,toast 提示后保持原页。

### 3.2 Access(`settingsAccess`)— 页内 tab:Collaborators | Teams | Moderation

- **Collaborators**:直接协作者列表(`GET /repos/{o}/{r}/collaborators?affiliation=direct` + 角色)、改角色、移除;顶部「添加协作者」表单(用户名 + 角色,`PUT .../collaborators/{username}`,201=已发邀请、204=直接加入);**Pending invitations** 列表(`GET .../invitations`)支持改权限(`PATCH`)和取消(`DELETE`)。角色选项:`pull|triage|push|maintain|admin`。
- **Teams**(仅 org 仓库,个人仓库隐藏此 tab):列表 `GET /repos/{o}/{r}/teams`;添加/改权限 `PUT /orgs/{org}/teams/{team_slug}/repos/{o}/{r}`;移除 `DELETE` 同路径。
- **Moderation**:Interaction limits 原生(`GET/PUT/DELETE /repos/{o}/{r}/interaction-limits`,limit `existing_users|contributors_only|collaborators_only` + expiry 五档,409 表示 org/user 级限制已生效 → 显示提示);Code review limits ↗ `/settings/review_limits`;Reported content ↗ `/settings/reported_content`。

### 3.3 Code & automation(`settingsAutomation`)— 页内 tab:Branches | Rules | Actions | Runners | Webhooks | Environments | Pages | Custom properties | Codespaces↗ | Copilot↗

- **Branches**(classic branch protection):受保护分支列表(`GET /repos/{o}/{r}/branches?protected=true`,逐分支 `GET .../protection` 取详情);只读详情(required reviews / status checks / enforce admins / force push 等摘要);删除保护 `DELETE .../protection`;「新建/编辑」↗ `/settings/branches`。注:REST 无法管理通配符 pattern 规则,只读列表对 pattern 规则显示不出——详情页加一行「通配符规则请在网页端查看」外链。
- **Rules**(Rulesets):列表 `GET /repos/{o}/{r}/rulesets`;只读详情 `GET .../rulesets/{id}`(target/enforcement/conditions/rules 摘要);启停 = `PUT` 仅改 `enforcement`(`active|disabled`);删除 `DELETE`;「新建/编辑」↗ `/settings/rules`。Tag 规则也在这里(GitHub 已下线独立 Tags 页)。
- **Actions**:General 权限表单——启用/allowed_actions(`GET/PUT .../actions/permissions`,含 `sha_pinning_required`);selected 时的 patterns(`.../selected-actions`);私有仓库工作流访问级别(`.../access`);artifact/log 保留天数(`.../artifact-and-log-retention`);fork PR 审批策略(`.../fork-pr-contributor-approval`);私有仓库 fork PR 工作流(`.../fork-pr-workflows-private-repos`);默认 workflow 权限 + PR 审批权(`.../workflow`,PUT 可能因 org 级锁定 409 → 显示「已由组织锁定」)。
- **Runners**:self-hosted 列表(`GET .../actions/runners`,状态/标签)、删除;「新建 runner」↗ `/settings/actions/runners/new`(注册流程复杂不原生做)。
- **Webhooks**:完整 CRUD——列表 `GET .../hooks`;创建/编辑表单(url、content_type、secret[只写]、insecure_ssl、events 多选、active)`POST`/`PATCH`;删除;ping `POST .../pings`;最近 deliveries 列表(`GET .../deliveries`)+ 单条详情 + redeliver(`POST .../attempts`)。
- **Environments**:列表;创建/编辑(wait_timer、prevent_self_review、reviewers ≤6(users/teams)、deployment branch policy:protected branches / custom policies + policy 明细 CRUD `.../deployment-branch-policies`);删除;**环境级 secrets/variables** CRUD(`.../environments/{env}/secrets|variables`,secrets 走 sealed-box)。环境名进 URL 需 encode(`/`→`%2F`)。
- **Pages**:启用/配置表单(`GET/POST/PUT/DELETE /repos/{o}/{r}/pages`:build_type `workflow|legacy`、source branch+path、cname、https_enforced);最新构建状态(`GET .../pages/builds/latest`)+ 触发构建(`POST .../builds`);未启用时显示启用引导;Pages 私有可见性 ↗。
- **Custom properties**:属性值编辑(`GET/PATCH /repos/{o}/{r}/properties/values`,definitions 是 org 级只读);无属性定义时显示空态。
- **Codespaces** ↗ `/settings/codespaces`(prebuilds 无 API);**Copilot code review** ↗ `/settings/copilot/code_review`(无 API)。

### 3.4 Security(`settingsSecurity`)— 页内 tab:Advanced Security | Deploy keys | Secrets & variables

- **Advanced Security**:开关组——`PATCH /repos/{o}/{r}` `security_and_analysis`(advanced_security / secret_scanning / push_protection 等,`enabled|disabled`,计划/plan 不可用时接口报错 → 该行显示不可用说明);Dependabot alerts(`GET/PUT/DELETE .../vulnerability-alerts`,GET 204/404 判状态);Dependabot security updates(`.../automated-security-fixes`);Private vulnerability reporting(`.../private-vulnerability-reporting`);Code scanning default setup 只读展示(`GET .../code-scanning/default-setup`)+ 配置 ↗;「Access to alerts」和依赖图开关无 API → 区块底部 ↗。
- **Deploy keys**:列表 + 添加(title、key、read_only)+ 删除(`GET/POST/DELETE /repos/{o}/{r}/keys`,不可编辑,删了重建)。
- **Secrets & variables**:顶部 `Segmented` 切 Actions / Codespaces / Dependabot 三个作用域。Actions 作用域展示两个列表:Secrets(`GET/PUT/DELETE .../actions/secrets`)与 Variables(`GET/POST/PATCH/DELETE .../actions/variables`);Codespaces / Dependabot 各自 secrets 列表。所有 secret 写入复用 user-settings 已有的 `sealSecret`(libsodium sealed-box,对各自 `/public-key` 加密);secret 值只写不可读,编辑即覆盖。列表同时只读展示 org 级继承的 secrets/variables(接口返回里带,标注「组织」徽标)。

### 3.5 Integrations(`settingsIntegrations`)— 页内 tab:Autolinks | GitHub Apps↗ | Email notifications↗

- **Autolinks**:列表 + 添加(key_prefix、url_template 含 `<num>`、is_alphanumeric)+ 删除(`GET/POST/DELETE /repos/{o}/{r}/autolinks`,不可编辑)。
- **GitHub Apps** ↗ `/settings/installations`(安装管理无用户 token API);**Email notifications** ↗ `/settings/notifications`(无 API)。

## Part 4 · 数据层

沿既有四层管线:api module → main IPC → preload → renderer composable。

**packages/api/src/modules/**(新增,按分类拆,每个配 `*.test.ts`):

- `repository-settings.general.ts` — PATCH repo(含 security_and_analysis)、topics、rename branch、transfer、delete、immutable-releases、GraphQL `updateRepository`(discussions/sponsorships)
- `repository-settings.access.ts` — collaborators、invitations、teams、interaction-limits
- `repository-settings.rules.ts` — branch protection(protected 分支列表+详情+删除)、rulesets(list/get/enforcement/delete)
- `repository-settings.actions.ts` — actions permissions 全套端点、runners
- `repository-settings.webhooks.ts` — hooks CRUD、pings、deliveries、redeliver
- `repository-settings.environments.ts` — 环境 CRUD、branch policies、环境级 secrets/variables(与既有 `deployments.ts` 的只读列表并存,互不影响)
- `repository-settings.pages.ts` — pages CRUD、builds
- `repository-settings.security.ts` — vulnerability-alerts、automated-security-fixes、private-vulnerability-reporting、code-scanning default-setup(读)、deploy keys
- `repository-settings.secrets.ts` — actions/codespaces/dependabot 仓库级 secrets + actions variables;`sealSecret` 从 `user-settings.ts` 提取到共享工具(如 `modules/seal-secret.ts`)双方复用

类型全部进 `packages/api/src/types.ts`,响应做与现有模块一致的手工映射(snake_case → 领域类型)。

**client/src/main/**:新增 `repository-settings.ts`,注册 `repository-settings:*` IPC(处理器薄封装,直接转发 api client;文件过大时按 `registerXxx` 函数分组,不拆文件)。

**preload**:`window.ohMyGithub.repositorySettings.*` 命名空间。

**renderer composables**:`composables/github/use-repository-settings.ts`(vue-query;query key 前缀 `['repository-settings', owner, repo, ...]`;mutation 成功后失效对应 query + 必要时失效 `repository-overview`,遵循已有的「detail 页 mutation 后刷新 list 缓存」约定)。

**OAuth scopes**:`defaultGitHubOAuthScopes` 追加 `delete_repo`(其余均被现有 `repo` 覆盖)。老 token 缺 scope 时,删除按钮所在行显示「需要重新授权」提示 + 去登录按钮(复用 Settings 窗口 missing-scopes 模式);其他操作不受影响。

## Part 5 · UI 模式与交互

- **表单不套圆角边框卡片**;bordered 容器只放列表行(collaborators / webhooks / keys / secrets 等),添加表单放在框外(项目既有约定)。
- **保存模型**:开关/下拉选择即时保存(乐观更新,失败回滚 + toast,和 watch/star 现有模式一致);文本类字段(名称、描述、topics、url_template 等)成组出现,变更后显示该组的 Save 按钮,保存中禁用。
- **Danger Zone**:红色语义分区(destructive 边框只用于此处的列表行容器);删除/转移/改可见性对话框要求输入 `owner/repo` 全名逐字匹配才激活确认按钮;归档为普通确认对话框。
- **错误处理**:403/404 → 分类页顶部错误态(参考 `github-tab-error` 模式);409(org 级锁定/已有更高层 interaction limit)→ 就地提示而非报错;secret/webhook secret 只写 → 编辑表单占位符 `••••••••`,留空表示不修改。
- **外链**:一律 `window.ohMyGithub.links.openExternal`(现有 links 通道),条目带 ↗ 图标。
- **i18n**:en/zh 全量,key 在 `repository.settings.*` 下;locale 文案中的 `@` 写成 `{'@'}`(locales.test.ts 会守护)。

## Part 6 · 测试

- api 模块:每个新模块配 mock octokit 单测(路径、参数、映射、错误分支),对齐现有 `deployments.test.ts` 等写法。
- `workspace-url`:`?tab=settings` 归一化、`sub` 参数解析/生成、非法值回落——补进现有 url 测试。
- 纯逻辑单测:danger-zone 全名确认校验、settings 子页归一化、secrets 表单「留空不修改」的提交裁剪。
- UI 手工验证:HMR 下逐分类页过一遍(用户侧已有运行中的 dev 实例)。

## Part 7 · 实施顺序(单一 spec,分 6 步落地)

1. **骨架**:SectionSidebar children + 路由/URL + 权限门控 + 5 个分类页壳(所有子页先以 ↗ 外链占位)+ i18n 骨架。
2. **General**:PATCH 表单全套 + GraphQL 开关 + Danger Zone + `delete_repo` scope。
3. **Access**:Collaborators / Teams / Moderation。
4. **Code & automation**:Actions → Webhooks → Environments → Pages → Branches/Rules(只读)→ Runners → Custom properties。
5. **Security**:Advanced Security 开关组 → Deploy keys → Secrets & variables(含 sealSecret 提取)。
6. **Integrations**:Autolinks。

每步结束可独立提交、可运行;外链占位保证任何时刻 Settings 页都是完整可用的。

## 明确不做

- Branch protection / Ruleset 的创建与编辑表单(跳网页)。
- Codespaces prebuilds、Copilot code review、GitHub Apps 管理、Email notifications、社交预览图、Code review limits、Reported content(均无 API,外链)。
- 网页端已下线的 Tags 保护页(不做入口)。
- org 级 secrets/variables、org 级 rulesets 的管理(仅只读标注来源)。
