# Account 页新增 Followers、Sponsors、People sections 设计

日期:2026-07-04
状态:已确认

## 目标

为 account 页面新增三个 section:

- 个人账号:**Followers & Following**、**Sponsors & Sponsoring**
- org 账号:**People**(成员查看/角色编辑/邀请/移除)+ 同样显示 Followers、Sponsors

同时把 PR details 页的 tab 切换器抽成共享组件,分页复用现有 `app-pagination`。

## 关键 API 事实(调研结论)

- GraphQL `followers` / `following` / `membersWithRole` 的 cursor 是不透明 `cursor:v2`,**不能**构造页码跳转;`sponsorshipsAsMaintainer` / `sponsorshipsAsSponsor` 是纯 offset cursor(base64 的 1-based 偏移,同 refs connection),可页码跳转,且节点自带 tier 数据。
- REST followers/following 列表只有 simple user(无 name/bio/viewer 关系),但原生 page/per_page 分页;总数在 profile 的 `followers`/`following` 字段。
- org 只有 REST followers(GraphQL `Organization` 无 followers connection);org 永远不 follow 别人。following 列表中可能出现 Organization(用户可以 follow org)。
- Sponsors 无 REST API,GraphQL-only。`Sponsorship` 子字段需要 `read:user`(app 默认已有)。私密赞助的 `sponsorEntity` 为 null;`hasSponsorsListing` 标识是否开通 Sponsors。
- org 成员管理 mutation 是 REST-only:邀请 `POST /orgs/{org}/invitations`(invitee_id 或 email,role `direct_member|admin`,限 50 或 500 次/24h,邀请 7 天过期)、改角色 `PUT /orgs/{org}/memberships/{u}`、移除 `DELETE /orgs/{org}/memberships/{u}`(兼顾 active 成员与 pending 邀请)、撤销邀请 `DELETE /orgs/{org}/invitations/{id}`。写操作需要 `admin:org` scope。
- 成员可见性 `PUT|DELETE /orgs/{org}/public_members/{username}` **只能操作自己**(GitHub 规则,owner 也不能改别人)。
- GraphQL `membersWithRole` 的 edge 带 `role`(MEMBER/ADMIN)和 `hasTwoFactorEnabled`(非 owner 查看时为 null);非 org 成员查询时只返回公开成员。

## 架构(方案 A:混合)

沿用四层结构:renderer composable(pinia-colada)→ preload bridge → main IPC → `@oh-my-github/api`。

### 共享组件

- **`components/navigation/tab-switcher.vue`**:从 `pull-request-header.vue` 提取 border-b 样式 tab nav(h-8、icon+label、active 底边框)。Props `tabs: {id, icon?, label, count?, disabled?}[]`、`activeId`、`ariaLabel`,emit `update:activeId`;count 渲染为徽标。PR header 重构为使用该组件,行为不变。
- 分页统一复用 `components/navigation/app-pagination.vue` 的 `pages` variant。

### 导航

`AccountTabId` 增加 `'followers' | 'sponsors' | 'people'`:

- 个人:overview / repositories / stars / followers / sponsors
- org:overview / repositories / people / followers / sponsors(stars 仍隐藏)

section 内部 tab(Followers|Following、Sponsors|Sponsoring、Members|Invitations)用 TabSwitcher,状态仅内存,不进 URL。org 的 Followers section 无 Following tab,直接单列表。

### 数据层

**Followers / Following**(扩展 `packages/api/src/modules/accounts.ts`):

- REST `GET /users/{username}/followers|following`(page/per_page)做分页骨架;每页一次 aliased GraphQL `repositoryOwner(login:)`(兼容 org 节点)批量补全 `name / bio / viewerIsFollowing / viewerCanFollow / isFollowingViewer`。
- totalCount 用 renderer 已缓存的 profile 计数,不额外请求;API 返回 items + hasNextPage(Link header)。
- follow/unfollow 复用现有 `setFollowed`。

**Sponsors / Sponsoring**(扩展 accounts 模块):

- GraphQL `sponsorshipsAsMaintainer` / `sponsorshipsAsSponsor`(activeOnly 默认),offset cursor 构造页码跳转(同 `refsPageCursor` 模式);节点取 `sponsorEntity`(User|Organization 内联 fragment)、`tier { name monthlyPriceInDollars isOneTime }`、`isOneTimePayment`、`privacyLevel`、connection `totalCount`。
- 轻量 summary 查询:`sponsorshipsAsMaintainer.totalCount`、`sponsorshipsAsSponsor.totalCount`、`hasSponsorsListing`,供 tab 计数与空状态。

**People**(新模块 `packages/api/src/modules/organization-people.ts`,`OrganizationPeopleApi`):

- 读取:GraphQL `membersWithRole` 100/页拉全、封顶 1000,一次 IPC 返回 `{login, name, avatarUrl, role, hasTwoFactorEnabled}[]` + `viewerCanAdminister` + totalCount;同时 REST `public_members` 拉全集合标注 isPublic。renderer 端做搜索/角色过滤/客户端分页,pinia-colada staleTime 缓存。
- 邀请列表:REST `GET /orgs/{org}/invitations`(403 视为无权限)。
- 写操作(全 REST):`inviteMember`(email 或先 `GET /users/{username}` 解析 invitee_id;role `direct_member|admin`)、`setMemberRole`、`removeMember`(DELETE memberships)、`cancelInvitation`、`setViewerMembershipVisibility`(PUT/DELETE public_members,仅 viewer 自己)。

**Scopes**:`defaultGitHubOAuthScopes` 增加 `admin:org`(新登录生效);main 进程按 `listMissingFollowScopes` 模式检测,缺失时 People 页顶部 warning banner + 禁用写操作。

## UI 设计

### Followers & Following(`pages/account/components/account-followers-section.vue`)

- 行:头像 + login + name + "Follows you" 徽标(`isFollowingViewer`)+ bio(单行截断)+ 行尾 Follow/Unfollow 按钮(自己的行不显示;缺 `user:follow` 禁用)。点击行打开对方 account tab。
- Follow 乐观更新,失败回滚 + refetch,成功后 `invalidateAccountProfile`。
- 分页 pages variant、每页 20、totalCount 取 profile 计数;骨架行 / 错误重试 / 空状态。

### Sponsors & Sponsoring(`account-sponsors-section.vue`)

- Tab 计数来自 summary 查询。行:头像 + login/name + bio;私密赞助 → 匿名行(锁图标 + "Private sponsor",不可点击)。
- 看自己的 profile(login == viewer.login)时行尾显示 tier 徽标(tier 名 + 月额;`isOneTimePayment` 标注一次性);看别人不显示。
- 空状态区分:未开通 Sponsors(`hasSponsorsListing: false`)vs 开通但为 0。Sponsoring tab 不受开通状态影响。

### People(`account-people-section.vue`,仅 org)

**Members tab**:

- 搜索框(300ms debounce,过滤 login/name)+ 角色过滤(All/Owner/Member),均客户端;分页客户端 pages variant。
- 行:头像 + login/name + 角色徽标(Owner/Member)+ 2FA 关闭警示图标(字段为 null 时不渲染)+ Public/Private 可见性徽标。
- 自己的行:可见性下拉(Public/Private);其他人的行无此操作(API 限制)。
- `viewerCanAdminister`:每行角色下拉(Member/Owner)+ 移除按钮。移除弹确认对话框,警示:失去所有 team 与私有仓库访问、其发出的邀请被取消、3 个月内可恢复保留数据。
- 改自己角色 / 最后一个 owner 等异常由 API 403/422 兜底,message 走 toast。

**Invitations tab**(仅 `viewerCanAdminister`,否则整个 tab 隐藏):

- pending 列表:login 或 email + 角色 + 邀请时间 + 邀请人,每行 Cancel。
- "Invite member" 按钮 → 对话框:单输入框(含 `@` 判为 email,否则按 username 解析,不存在报错)+ 角色选择(Member/Owner)。提交后失效查询;422(已是成员/已邀请/超限)透出 API message。
- Failed invitations 本期不做。

非 org 成员访客:GraphQL 只返回公开成员,自然降级为只读公开列表,无需特判。

## 错误处理通则

- 读取失败 → 现有 Empty + 重试模式。
- 写操作失败 → 恢复乐观状态 + toast(沿用 PR 页 mutation 错误形态)。
- 403 视同权限不足(隐藏/禁用对应 UI),不作为错误弹出。
- 缺 `admin:org` → People 页 warning banner(复用 follow scope banner 样式)。

## 测试

- `packages/api` 按现有 `*.test.ts`(mock octokit)覆盖:followers GraphQL 补全合并、following 中 org 节点映射、sponsorships offset cursor 与私密行映射、membersWithRole 分页拉全 + public set 合并、邀请 payload(email vs invitee_id)归一化。
- 邀请输入判定(email/username)抽纯函数单测。
- i18n en/zh 新增 `account.followers.* / account.sponsors.* / account.people.*`,`@` 用 `{'@'}` 转义,由 locales.test.ts 守护。

## 范围外

- Failed invitations 列表与重试。
- billing_manager 角色。
- 邀请输入 typeahead 搜索。
- outside collaborators 管理。
