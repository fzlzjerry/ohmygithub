# Issue / PR 详情页 Reactions 完整实现设计

日期:2026-07-03

## 目标

Issue / PR 详情页的 reactions 目前只显示纯文字(如 `thumbs-up 1`)。目标:

1. 显示 emoji(👍 👎 😄 🎉 😕 ❤️ 🚀 👀)
2. 显示数量
3. 显示当前用户是否已点(高亮态,数据已有 `viewerHasReacted`)
4. 点击切换 reaction;并提供「添加 reaction」选择器(SmilePlus 按钮 + Popover,列出全部 8 个),对齐 GitHub 行为

作用范围:reaction bar 当前渲染的所有位置 —— issue 正文、issue 评论、PR 正文、PR 评论、PR review 行内评论。

## 方案

选择「GraphQL addReaction/removeReaction + subject node id」方案(备选的 REST reactions API 需要按 subject 类型区分多个端点,且拿不到 viewerHasReacted 一致性,弃用)。

### packages/api

- `types.ts`
  - 新增 `GitHubReactionContent` 联合类型(8 种,与现有 `normalizeReactionContent` 的输出一致)。
  - `GitHubIssueComment`、`GitHubPullRequestReviewComment` 增加 `nodeId: string`(GraphQL node id,mutation 需要;现有 `id` 带 `issue-comment:` 等前缀且用的是 databaseId,不可用)。
  - 新增 `SetReactionOptions { subjectId: string; content: GitHubReactionContent; reacted: boolean }`(reacted 为期望的新状态)。
- `modules/issues.ts`
  - `mapComments` 输出 `nodeId: comment.id`;`mapRestIssueComment` 输出 `nodeId: comment.node_id ?? ''`。
  - `IssuesApi.setReaction(options)`:`reacted ? addReaction : removeReaction` GraphQL mutation;新增 content → GraphQL 枚举的反向映射。
- `modules/pulls.ts`:同样为 comments / review comments 输出 `nodeId`。
- `client.ts`:facade 增加 `setReaction`。
- `mock.ts`:补 `nodeId`、`setReaction` mock。

### Electron main / preload

- `main/issues.ts`:`issues:set-reaction` handler → `api.issues.setReaction`(subjectId 通用,issue/PR 共用)。
- `preload/index.ts`:`issues.setReaction(subjectId, content, reacted)`。
- `renderer/env.d.ts`:同步类型(nodeId 字段、bridge 方法)。

### Renderer

- 新增 `components/conversation/reactions.ts`:`REACTION_CONTENTS`、`REACTION_EMOJI` 映射。
- `conversation-reaction-bar.vue` 重写:
  - Props:`reactions`、`canReact?: boolean`。
  - 展示:emoji + 数量;`viewerHasReacted` 高亮(沿用现有 primary 高亮样式)。
  - 交互(canReact):badge 变按钮,点击 emit `toggle(content, nextReacted)`;尾部 SmilePlus 按钮弹出 Popover 列出 8 个 emoji(已点的高亮),点击同样 emit。
  - 乐观更新:内部 overlay(content → 期望状态),点击立即修正显示;`props.reactions` 引用变化(refetch 完成)时清空。
  - canReact 为 false 时保持只读展示(有 reaction 才渲染)。
- `conversation-body-card.vue` / `conversation-comment-card.vue`:透传 `canReact` + `reaction-toggle` 事件。
- `pull-request-review-card.vue`:review 行内评论的 bar 变为可交互,emit 带上 comment.nodeId;canReact 时即使还没有 reaction 也渲染 bar(为了显示添加按钮)。
- 新增 `composables/github/use-reactions.ts`:`setReaction(subjectId, content, reacted)` 调 bridge。
- `issue-page.vue` / `pull-request-page.vue`:处理 toggle → 调 setReaction → `refetch()`(失败也 refetch 以回滚乐观态)。正文 subject 为 `detail.nodeId`,评论为各自 `nodeId`。`canReact = !locked`。
- issue 页本地类型(`pages/issue/components/types.ts`)与 timeline composable 增加 `nodeId` 透传;PR 页类型是全局类型别名,随 env.d.ts 自动获得。
- i18n:en/zh 增加 `conversation.reactions.add`("Add reaction" / "添加表情回应")。

## 错误处理

mutation 失败:catch 后 refetch(服务端真实状态覆盖乐观态),不弹错误框(与 GitHub 行为一致的轻量交互)。

## 测试

以 typecheck/lint 为准(仓库无对应组件测试);功能通过运行中的 HMR app 人工验证。
