# Repository Actions 页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在仓库页实现 GitHub Actions run 列表，并用独立 workspace tab 展示单个 workflow run 的 summary、jobs、steps 和运行中日志刷新。

**Architecture:** 新增 `@oh-my-github/api` 的 `actions` 模块封装 GitHub Actions REST API，main/preload 只暴露窄 IPC，renderer 通过 Pinia Colada composables 读取结构化数据。仓库页 `Actions` tab 负责 workflow 选择和 run list；点击 run 打开 `/:owner/:repo/actions/runs/:runId` 独立 tab。运行中“stream”用轮询 run/jobs/selected job logs 实现，完成后停止轮询。

**Tech Stack:** Vue 3 `<script setup>`、Pinia Colada、Electron IPC/preload、Octokit REST、`@oh-my-github/ui`、lucide-vue-next、vue-i18n。

---

## Key Changes

- 新增 API 类型和模块：`GitHubActionWorkflow`、`GitHubActionRun`、`GitHubActionJob`、`GitHubActionStep`、`GitHubActionJobLog`、`GitHubActionRunPage`；模块方法为 `listRepositoryWorkflows`、`listRepositoryWorkflowRuns`、`getWorkflowRun`、`listWorkflowRunJobs`、`getWorkflowJobLog`。
- 新增 main/preload bridge：`window.ohMyGithub.actions.*`；renderer 不接触 token、Octokit、日志重定向 URL。
- 扩展 workspace URL：新增 `action-run` tab，解析 `/:owner/:repo/actions/runs/:runId`，并在 `workspace-panel.vue` 渲染 `ActionRunPage`。
- 仓库页新增 `pages/repository/components/actions/`：`section.vue`、`workflow-select.vue`、`run-list.vue`、`run-row.vue`。顶部 select 包含 `All` 和所有 workflow，支持搜索，disabled workflows 仍可选以查看历史 runs。
- 新增可复用 renderer 组件：`components/navigation/searchable-select.vue`；新增 `components/actions/action-status-icon.vue`、`action-status-badge.vue` 用于 run/job/step 状态展示。
- 新增 detail 页面 `pages/action-run/action-run-page.vue`，拆分 header、summary、jobs sidebar、steps/log viewer；左侧 jobs 列表选择 job，右侧展示 steps 和日志。
- 运行中刷新策略：run detail 每 5s 刷新 run/jobs；选中的运行中 job logs 每 3s 刷新；repository run list 如当前页有非 completed run，每 15s 刷新；所有轮询在 tab 非 active 或 run completed 后停止。

## Implementation Tasks

- [ ] **Task 1: API contract + Actions module**
  - Modify `packages/api/src/types.ts` with the Actions types and option objects.
  - Create `packages/api/src/modules/actions.ts`.
  - Modify `packages/api/src/client.ts`, `packages/api/src/index.ts`, and `packages/api/src/mock.ts`.
  - Use official endpoints:
    - Workflows: `GET /repos/{owner}/{repo}/actions/workflows`
    - Runs: `GET /repos/{owner}/{repo}/actions/runs` and `GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs`
    - Run detail: `GET /repos/{owner}/{repo}/actions/runs/{run_id}`
    - Jobs/steps: `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`
    - Logs: `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs`, normalize followed redirect response to plain text.
  - Normalize unknown GitHub statuses with string-safe unions rather than dropping data.
  - Run: `pnpm --filter @oh-my-github/api typecheck`.

- [ ] **Task 2: Electron bridge**
  - Create `packages/client/src/main/actions.ts` with validation for owner/repo/runId/jobId/page/perPage/workflowId.
  - Register it in `packages/client/src/main/index.ts`.
  - Extend `packages/client/src/preload/index.ts` and `packages/client/src/renderer/env.d.ts`.
  - Keep logs as text payloads from main to renderer; do not expose raw token or temporary redirect URL.

- [ ] **Task 3: Workspace route/tab support**
  - Modify `packages/client/src/renderer/pages/workspace/types.ts` to add `action-run` and `runId`.
  - Modify `workspace-url.ts` to parse `/:owner/:repo/actions/runs/:runId` before generic repo parsing, add `createActionRunWorkspaceUrl(owner, repo, runId)`, and give action tabs stable titles.
  - Modify `workspace-panel.vue` to render the new `ActionRunPage`.
  - Keep repo `?tab=actions` unchanged for the list view.

- [ ] **Task 4: Shared composables and components**
  - Create `packages/client/src/renderer/composables/github/use-actions.ts` with Pinia Colada queries for workflows, runs, run detail, jobs, and job log.
  - Create `components/navigation/searchable-select.vue` using Popover + Command primitives, with keyboard search and `select-none` labels.
  - Create `components/actions/action-status-icon.vue` and `action-status-badge.vue`; map `success` to success, `failure/timed_out/cancelled/action_required` to destructive or warning as appropriate, `queued/in_progress/waiting/pending/requested` to pending, `skipped/neutral/stale` to muted.

- [ ] **Task 5: Repository Actions list**
  - Replace the current Actions empty state in `repository-page.vue` with `ActionsSection`.
  - Implement `workflow-select.vue` with `All` plus fetched workflows; local search matches workflow name/path/state.
  - Implement paginated `run-list.vue` and clickable `run-row.vue`; row shows status, workflow/run title, event, branch, actor, run number/attempt, started/updated time.
  - On row select, push `createActionRunWorkspaceUrl(owner, repo, run.id)`.
  - Add loading, empty, error, retry, permission/error copy in `en.json` and `zh.json`.

- [ ] **Task 6: Action run detail page**
  - Implement `ActionRunPage` with missing identity, loading, error, unavailable states matching PR/Issue page patterns.
  - Header contains workflow/title/status and repository/run metadata.
  - Summary shows event, branch, commit SHA, actor, run number/attempt, duration, created/started/updated/completed times, and GitHub URL action.
  - Jobs sidebar lists all jobs with status/conclusion/duration; first job auto-selected, but preserve user selection while data refreshes.
  - Job detail shows steps and selected job logs; completed jobs show final logs, running jobs poll logs and append/refresh text.
  - If logs are unavailable/expired/403/404, show a retryable state without failing the whole page.

- [ ] **Task 7: Live refresh behavior**
  - Add `use-action-run-live-refresh.ts` or local composable logic owned by the detail page.
  - Poll only when the workspace tab is active and the run/job is not completed.
  - Stop timers on unmount and after completed status.
  - Use conservative intervals: run/jobs 5s, logs 3s, run list 15s only when visible page has active runs.
  - Avoid concurrent refetch overlap by skipping a tick if the prior refetch is still pending.

- [ ] **Task 8: Validation and polish**
  - Run `pnpm --filter @oh-my-github/api typecheck`.
  - Run `pnpm typecheck`.
  - Run `pnpm --filter @oh-my-github/client build`.
  - Manually verify: repo Actions tab loads workflows, `All` works, workflow filtering works, run click opens an independent tab, detail shows jobs/steps/logs, active run polling stops after completion, disabled/no-workflow/private-permission states render cleanly.
  - Keep `.superpowers/` out of commits.

## Test Cases And Scenarios

- Repository with no workflows: list page shows empty workflow/run state.
- Repository with disabled workflows: select shows disabled state; selecting still displays historical runs.
- `All` selected: uses repository runs endpoint and paginates.
- Specific workflow selected: uses workflow runs endpoint and resets to page 1.
- Run statuses: queued, in_progress, completed/success, failure, cancelled, skipped, timed_out, action_required, neutral.
- Detail missing/invalid URL identity: shows missing identity state.
- Jobs include steps: selecting a job updates steps/log panel.
- Running job: polling refreshes run/jobs/logs; completed run stops polling.
- Log API 403/404/expired/empty: job log panel shows retryable message, page remains usable.
- Permission/rate-limit errors: renderer shows error/retry state; no raw token or redirect URL crosses preload.

## Assumptions

- v1 is read-only: no rerun, cancel, approve deployment, workflow dispatch, artifact download, or annotations UI.
- “Stream” means polling-backed live refresh because GitHub job logs API returns a short-lived plain-text download redirect, not a long-lived push stream.
- Existing OAuth scope defaults are sufficient for v1; do not add new auth flows unless implementation discovers a concrete missing-permission state.
- Use existing design density and i18n rules; no raw colors, no marketing-style layout, no renderer Node/Electron imports.
