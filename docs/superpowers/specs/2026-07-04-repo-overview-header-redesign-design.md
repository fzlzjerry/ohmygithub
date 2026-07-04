# Repo Overview 信息区重构:单行信息项 + Languages 占比条 + Contributors 头像区

日期:2026-07-04
状态:已确认

## 目标

重构 repository 页 Overview summary card 的下半部分:

1. 信息项(Stars/Forks/License 等)从表格式卡片改为紧凑单行列表,数值右对齐,按数量纵向分 2/3 列。
2. 新增 Languages 占比条(对齐 GitHub 侧边栏样式),数据用已有的 `overview.languages`。
3. 新增 Contributors 头像区,与 Languages 同行 1:1 并列,头像最多两行,点击应用内打开用户页。

## 1. 信息项列表重构(`overview-info-grid.vue`)

去掉表格式边框,改为纯列表行:

- 每行:图标 + 名称(muted 色,居左)+ 数值(`font-medium`,`ml-auto` 右对齐);链接型数值(License 等)保持 primary 色 + hover underline。
- 分列:脚本中按「每列最多 5 项」纵向切分,`列数 = clamp(ceil(items / 5), 2, 3)`,先填满第一列再换列。
- 渲染:`flex flex-wrap` 容器,每列 `flex-1 min-w-[240px]`;宽窗口并排 2/3 列,窄窗口列自然折行,不用 JS 断点监听。
- 列间距较大(`gap-x-8` 级别),行内紧凑(每行约 py-1.5)。
- 分列 chunk 逻辑抽为纯函数,便于单测。
- summary card 中的 skeleton 同步改成单行样式(圆点 + 左 label 条 + 右 value 条)。

## 2. Languages 占比条(新组件 `overview-languages.vue`)

数据:`overview.languages`(`{name, bytes}[]`,API 已按字节降序返回),无 API 改动。

- 百分比计算:取前 6 个语言,其余合并为「Other」;显示一位小数。
- 顶部横条:`h-2 rounded-full overflow-hidden`,flex 按百分比分段着色,段间 1px 间隙。
- 图例:色点 + 语言名(foreground/medium)+ 百分比(muted),`flex flex-wrap` 排布(视觉近似 GitHub 两列)。
- 颜色:新增 `language-colors.ts`,内置 linguist 官方 name→hex 常量表;未知语言与 Other 用灰色 fallback(muted 系)。
- `overview.languages` 为空(含 `languages_unavailable` warning)时整块隐藏。
- 百分比/Other 合并逻辑抽为纯函数,便于单测。

## 3. Contributors 头像区(新组件 `overview-contributors.vue` + 轻量 API)

现有 `stats/contributors` 接口冷仓库会 202 pending,不适合 Overview 首屏,故新增轻量列表接口,沿用四层链路(api → main IPC → preload/env.d.ts → renderer composable):

- `packages/api`:
  - 新类型 `GitHubRepositoryContributorSummary { id, login, avatarUrl, contributions, type }`。
  - `repositories.ts` 新增 `listRepositoryContributors`(`GET /repos/{owner}/{repo}/contributors`,`per_page=30`,排除 anonymous 条目)。
  - 补 `client.ts` 接口声明与 `mock.ts` 实现。
- `packages/client`:
  - `src/main/repositories.ts` 新增 IPC handler,`env.d.ts` 补类型。
  - `use-repositories.ts` 新增 `useRepositoryContributorsQuery`。

组件行为:

- 标题「Contributors」+ 右侧「查看全部 →」链接,点击切到该 repo 的 Contributors tab。
- 头像:复用 `GithubActorLink`(`show-username=false`),点击应用内打开 account 页;`title` 属性显示 login。
- 两行上限:`flex flex-wrap` + `max-height`(两行头像高度)+ `overflow-hidden`,自适应宽度,不做 +N 徽标(溢出靠「查看全部」入口)。
- 加载中:两行圆形 skeleton;请求失败或列表为空时整块隐藏。

不采用的替代方案:ResizeObserver 测宽计算每行个数再 slice + 显示 +N(更像 GitHub 侧边栏,但复杂度不值)。

## 4. 布局与收尾

summary card 内容顺序:描述/主页/topics → 分隔线 → 信息项列表(新样式) → Languages ↔ Contributors 行 → custom properties。

- Languages/Contributors 行:`grid sm:grid-cols-2 gap-6`,1:1;窄窗口纵向堆叠;一块隐藏时另一块占满整行;两块都隐藏时整行不渲染。
- i18n:`en.json` / `zh.json` 新增 `repository.overview.languages`、`repository.overview.contributors`、`repository.overview.viewAllContributors` 等 key(遵守 `@` 转义规则)。
- 测试:overview 目录下新增纯函数单测(信息项分列 chunk、语言百分比/Other 合并),风格参考 `repository-section-counts.test.ts`。
