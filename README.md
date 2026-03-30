# MyLife

A personal second-brain PWA. Markdown notes stored in a private GitHub repo, accessible from any browser, works offline.

## How it works

- Notes are plain `.md` files committed to a private GitHub repo you own
- The app reads and writes them via the GitHub REST API using a personal access token
- Everything is cached in IndexedDB so the app works offline and loads instantly
- Changes made offline are queued and synced automatically when you reconnect
- Deployed as a static site on GitHub Pages — no server, no database

## Getting started

1. Create a private GitHub repo to store your notes (e.g. `yourname/my-notes`)
2. Generate a GitHub personal access token with `repo` scope
3. Open the app and enter your token and repo name on the setup screen

## Development

```sh
npm install
npm run dev
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (static output to `build/`) |
| `npm run preview` | Preview production build |
| `npm run check` | TypeScript type checking |
| `npm run lint` | ESLint |
| `npm run format` | Prettier check |
| `npm run test` | Unit and integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run validate` | Run all checks |

## Tech stack

- **SvelteKit 2 + Svelte 5** (runes) — client-only SPA, no SSR
- **GitHub REST API** — CRUD on markdown files in a private repo
- **IndexedDB** (idb-keyval) — local cache and offline queue
- **CSS custom properties** — Catppuccin Mocha colour palette, no CSS framework

## Testing

Follows the [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications) — integration tests are the bulk.

- `tests/integration/` — `@testing-library/svelte` + Vitest + jsdom. Only `fetch` is mocked; stores, cache, and sync engine are real.
- `tests/e2e/` — Playwright tests for critical user journeys against the running dev server.

## CI

Every push to `main` runs type checking, linting, format checking, unit tests, and E2E tests in parallel before deploying to GitHub Pages.
