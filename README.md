# Oh My GitHub

Oh My GitHub is an Electron desktop workspace for GitHub notifications, pull requests, issues, and actions.

This first scaffold focuses on a fast Notion-like app shell with mock GitHub data. Real OAuth, API sync, and local persistence are intentionally left as follow-up layers.

## Stack

- TypeScript
- Vue 3
- Vite
- Electron
- electron-vite
- Reka UI
- pnpm workspaces

## Packages

- `packages/ui` - shared Vue UI primitives built around Reka UI and app theme styles.
- `packages/api` - GitHub API contracts plus a mock client.
- `packages/client` - Electron main, preload, and Vue renderer app.

## Scripts

```sh
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```
