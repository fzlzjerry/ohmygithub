# @oh-my-github/web

The public landing page for **Oh My GitHub** — a Vite + Vue 3 + TypeScript
single-page site that reuses the shared `@oh-my-github/ui` design system (Tailwind
v4 tokens, dark mode, components) so it matches the desktop app. It offers
per-platform download buttons, English/中文 switching, and light/dark theming.

## Local development

```bash
# from the repo root
pnpm install
pnpm dev:web        # start the dev server
pnpm build:web      # type-check + production build → packages/web/dist
pnpm preview:web    # preview the built site
```

## Environment variables

### `VITE_R2_PUBLIC_BASE_URL` (build-time, optional)

The public base URL the download buttons build artifact links from — the
`VITE_`-prefixed counterpart of the app's `R2_PUBLIC_BASE_URL`.

- **Default:** `https://resource.oh-my-github.app` (see `src/lib/downloads.ts`).
- **Local override:** copy `.env.example` → `.env` and set it.
- **Production:** provided by the deploy workflow (see below).

> Download filenames are built from the electron-builder `artifactName` templates
> plus the **monorepo version**, which is baked in at build time from the root
> `package.json` (`bumpp -r` keeps every package in sync). Filenames look like
> `Oh My GitHub-<version>-<arch>.<ext>` (spaces URL-encoded). **The landing page
> must be rebuilt/redeployed after each app release** so the links point at the
> new version. This can be automated later (e.g. trigger `deploy-web` from the
> publish workflow).

## Deployment (Cloudflare Pages)

Deploys are automated by `.github/workflows/deploy-web.yml`: on pushes to `main`
that touch `packages/web/**` or `packages/ui/**` (and via manual
`workflow_dispatch`), it builds the site and runs `wrangler pages deploy dist`.

### Required GitHub repository secrets

Configure these under **Settings → Secrets and variables → Actions**:

| Name | Type | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | secret | Cloudflare API token with the **Account › Cloudflare Pages › Edit** permission. |
| `CLOUDFLARE_ACCOUNT_ID` | secret | Your Cloudflare account ID (Dashboard → Workers & Pages → Account details). |
| `VITE_R2_PUBLIC_BASE_URL` | secret **or** variable | Optional. Overrides the default download base URL. Omit to use the built-in default. |
| `CLOUDFLARE_PAGES_PROJECT` | variable | Optional. Cloudflare Pages project name. Defaults to `oh-my-github-web` (also set in `wrangler.toml`). |

### First-time Cloudflare setup

1. Create a Cloudflare Pages project named `oh-my-github-web` (or set
   `CLOUDFLARE_PAGES_PROJECT` to your chosen name). A **Direct Upload** project is
   enough — the GitHub Action pushes the built `dist/`.
2. Create the API token and copy your account ID; add both as repo secrets above.
3. Push a change under `packages/web/**` (or run the workflow manually) to deploy.

`wrangler.toml` pins the project name, `compatibility_date`, and
`pages_build_output_dir = "dist"`.
