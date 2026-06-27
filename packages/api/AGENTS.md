# API Package Agent Instructions

## Role

`@oh-my-github/api` is the GitHub-facing domain API for the desktop app. It is not a thin export of Octokit and it is not a renderer data store.

Use `octokit` as the transport foundation, then expose higher-level APIs grouped by Oh My GitHub app modules:

- `inbox`: notifications, review requests, assigned issues, and other triage items.
- `pulls`: pull request list/detail/review workflows.
- `issues`: issue list/detail workflows.
- `actions`: workflow runs, check suites, and CI status.
- `repositories`: repository metadata, permissions, branches, and local workspace entry points.
- `accounts`: authenticated viewer/account metadata.
- `auth`: GitHub OAuth Device Flow, token polling, and authenticated viewer validation.

Only add a module when there is an app surface that needs it. Keep module names aligned with product navigation and user workflows, not with GitHub REST endpoint names.

## Octokit Boundary

- Create Octokit instances through `createGitHubApi()` / `createOctokit()`.
- Internal modules may use both `octokit.rest.*` and `octokit.graphql()`.
- Public APIs should return app-shaped TypeScript objects from `types.ts`, not raw REST or GraphQL responses.
- Do not leak Octokit response shapes into the renderer. If a GitHub field is needed by UI, map it into a package-owned type.
- Use REST when the endpoint directly supports the data and pagination shape.
- Use GraphQL when REST cannot express the requested projection efficiently, when fields are GraphQL-only, or when a module needs a composed object across GitHub resource types.
- Keep REST and GraphQL decisions inside the module; callers should not need to know which transport was used.

## Structure

Use this layout:

```text
src/
  index.ts              # public exports
  client.ts             # createGitHubApi() composition root
  transport.ts          # Octokit construction and shared transport types
  types.ts              # public app-shaped contracts
  mock.ts               # mock implementation for renderer/dev surfaces
  modules/
    inbox.ts            # module-level high-level API
```

As the package grows, prefer one file per module first. Split a module only when it has clear subdomains such as `pulls/reviews.ts` or `actions/runs.ts`.

## API Design Rules

- Public methods should describe product intent, for example `inbox.listWorkspaceItems()` or `pulls.listReviewRequests()`.
- Avoid public methods named after raw GitHub endpoints such as `listNotificationsForAuthenticatedUser()`.
- Accept explicit option objects. Avoid positional booleans.
- Keep pagination decisions deliberate. If a method returns a bounded list, expose `limit`; if it returns a cursor-driven collection, model cursor/page info explicitly.
- Normalize dates as ISO strings at the package boundary.
- Normalize actor fields to `{ login, avatarUrl? }`.
- Normalize repository names as `owner/name`.
- Errors from Octokit may be allowed to propagate, but UI-facing wrappers should eventually translate them into app error types.

## Mock Contract

`MockGitHubClient` must continue to satisfy the same public contract used by the renderer. When a real API method is added for a new surface, add or update mock data in the same shape so UI development can proceed without GitHub auth.

## Validation

Before handing off API changes, run:

```bash
pnpm --filter @oh-my-github/api typecheck
pnpm typecheck
```
