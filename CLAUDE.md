## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: none

---

# CLAUDE.md

## Project Overview
MyLife — personal second-brain PWA. Single-user note-taking app that stores markdown files in a private GitHub repo, deployed as a static site on GitHub Pages.

## Architecture
- SvelteKit 2 + Svelte 5 (runes) — client-only SPA (no SSR, no prerender)
- GitHub REST API for CRUD on markdown files in a private repo
- IndexedDB (idb-keyval) for local caching and offline support
- Service worker for PWA offline asset caching
- CSS custom properties (Catppuccin Mocha palette) — no CSS framework

## Git Workflow
**Commit and push directly to `main`. No branches, no PRs.** This is a single-developer personal project — keep it simple. Push often, push small.

### Commit Message Format
Use conventional commit prefixes:
- `feat:` — new feature or capability
- `fix:` — bug fix
- `test:` — adding or updating tests
- `chore:` — tooling, config, dependencies
- `ci:` — CI/CD changes
- `refactor:` — code restructuring without behavior change

Keep messages short (under 72 chars first line). Focus on *why*, not *what*.

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build (static output to `build/`)
- `npm run preview` — Preview production build
- `npm run check` — TypeScript type checking (svelte-check)
- `npm run lint` — ESLint
- `npm run format` — Prettier check
- `npm run test` — Vitest (integration tests)
- `npm run validate` — Run ALL checks: check + lint + format + test

**Always run `npm run validate` before committing.**

## Testing Strategy
Follow the Testing Trophy (Kent C. Dodds):
- **Integration tests are the bulk** — use `@testing-library/svelte` + Vitest + jsdom
- **Only mock the network boundary** (fetch for GitHub API). Everything else is real: stores, cache (in-memory idb-keyval mock), sync engine
- **Test factories** in `tests/factories.ts` — use `createTestNote()`, `createTestConfig()`, `githubResponse()` etc.
- **No shallow rendering** — components render their full child tree
- **Test state through UI** — don't test stores in isolation
- **E2E tests** with Playwright for critical user journeys
- Test files live in `tests/integration/` and `tests/e2e/`

## Code Conventions

### Svelte
- Svelte 5 runes: use `$state`, `$derived`, `$effect`, `$props` — NOT legacy stores or `$:` reactivity
- Component props use `interface Props` pattern with `$props()`
- Catppuccin Mocha color tokens via CSS custom properties (defined in `app.css`)
- Flat, monochrome SVG line icons — no color icons, no emoji in UI

### TypeScript
- Strict mode — no `any`, no `@ts-ignore`
- Shared types live in `src/lib/types.ts`
- Prefer interfaces over type aliases for object shapes

### Naming
- **Files**: `kebab-case.ts` for modules, `PascalCase.svelte` for components
- **Stores**: `*.svelte.ts` — export functions (`getNotes()`, `createNote()`), not raw state
- **Tests**: `*.test.ts` — named after what they test (`note-creation.test.ts`, not `notes.test.ts`)
- **Factories**: `createTest*()` prefix (`createTestNote()`, `createTestConfig()`)

### Error Handling
- `github.ts` throws on API errors — it's the network boundary
- Stores catch errors and surface them to the UI via reactive state
- Components display errors to the user — never swallow silently
- No try/catch in deep library code unless recovering is meaningful

## File Structure
- `src/lib/` — shared code (stores, API clients, components)
- `src/lib/stores/` — Svelte 5 rune-based state (`.svelte.ts` files)
- `src/lib/components/` — reusable Svelte components
- `src/routes/` — SvelteKit file-based routing
- `tests/integration/` — integration tests (@testing-library/svelte)
- `tests/e2e/` — Playwright end-to-end tests
- `tests/factories.ts` — test data factories
- `tests/setup.ts` — global test setup (idb-keyval mock)

## Key Design Decisions
- Client-only SPA (ssr=false, prerender=false) — needs browser APIs
- GitHub PAT stored in browser IndexedDB (single-user app)
- Notes are plain markdown files in a private GitHub repo
- Offline-first: read from IndexedDB, sync to GitHub when online
- Soft delete: moves files to `.trash/` folder in repo

## Do NOT
- Use `localStorage` for the GitHub PAT — use IndexedDB via `NoteCache`
- Make direct `fetch()` calls outside `src/lib/github.ts` — all GitHub API access goes through `GitHubClient`
- Import from `@testing-library/react` — this is Svelte, use `@testing-library/svelte`
- Use Svelte legacy syntax (`$:`, `export let`, writable stores) — Svelte 5 runes only
- Add CSS frameworks (Tailwind, Bootstrap, etc.) — we use hand-written CSS with Catppuccin tokens
- Create feature branches or PRs — commit directly to main
