# MyLife App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal second-brain PWA that stores notes as markdown files in a private GitHub repo, deployed as a static site on GitHub Pages.

**Architecture:** SvelteKit static app with client-side only logic. GitHub REST API for CRUD on markdown files in a private repo. IndexedDB (via idb-keyval) for local caching and offline support. Service worker for PWA install and offline asset caching.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), `@sveltejs/adapter-static`, TypeScript (strict), Vitest + `@testing-library/svelte` + `jsdom`, Playwright (E2E), ESLint + Prettier, idb-keyval, GitHub REST API, Web Speech API, CSS (no framework — Catppuccin Mocha tokens as CSS custom properties)

---

## Quality Toolchain

Every task must pass these checks before committing. Set up in Task 1, enforced throughout:

```bash
npm run check      # svelte-check (TypeScript strict)
npm run lint       # ESLint
npm run format     # Prettier --check
npm run test       # Vitest
```

A single `npm run validate` script chains all four. Every commit runs `validate`.

---

## Testing Strategy: The Testing Trophy

Following [Kent C. Dodds' Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications):

```
    ╱ E2E ╲          ← Playwright: critical user journeys (added in Phase 2 once base app works)
   ╱────────╲
  ╱Integration╲      ← THE BULK: @testing-library/svelte + vitest + jsdom
 ╱──────────────╲       Test components as users see them. Real stores, real cache (mocked idb-keyval),
╱                ╲      real sync logic. Minimal mocking — only mock the network boundary (fetch).
╱  Static Analysis ╲ ← TypeScript strict + ESLint + Prettier (catches bugs before tests run)
╱────────────────────╲
```

### Principles

1. **Integration tests are the bulk.** Test components rendered in jsdom with `@testing-library/svelte`. Assert what the user sees, not implementation details.
2. **Minimal mocking.** Only mock what crosses a network boundary (`fetch` for GitHub API). Everything else — stores, cache (via idb-keyval in-memory mock), sync engine — uses real implementations wired together.
3. **Test factories** for creating test data. A `createTestNote()` factory instead of duplicating `{ path: '...', title: '...', ... }` in every test.
4. **No shallow rendering.** Components render their full child tree. If `Editor` uses `TodoItem`, the test renders both.
5. **State management tested through UI.** Don't test stores in isolation — test them by rendering a component that uses the store and asserting on screen output.
6. **E2E tests added later** (Task 12) once the base app is working. Cover critical user journeys: setup → create note → edit → delete → search.

### Test File Structure

```
tests/
├── factories.ts              # Test factories: createTestNote(), createTestFolder(), etc.
├── setup.ts                  # Global test setup: idb-keyval mock, fetch mock helpers
├── integration/
│   ├── github-client.test.ts # GitHub API client (fetch mocked, everything else real)
│   ├── sync-engine.test.ts   # Sync engine with real cache + mocked GitHub
│   ├── setup-page.test.ts    # Setup page component: renders form, validates, saves config
│   ├── note-creation.test.ts # Create note flow: button click → store updates → UI reflects
│   ├── note-editor.test.ts   # Editor: type text → auto-save fires → content updates
│   ├── folder-nav.test.ts    # Sidebar folder tree + note list rendering
│   ├── search.test.ts        # Search bar: type query → results appear
│   ├── youtube-embed.test.ts # Paste YouTube URL → embed renders
│   └── todo-toggle.test.ts   # Todo checkbox: click → toggles → content updates
└── e2e/                      # Added in Task 12 (Phase 2)
    ├── setup.test.ts
    ├── notes.test.ts
    └── navigation.test.ts
```

### `@testing-library/svelte` — NOT React Testing Library

This is a Svelte project. We use `@testing-library/svelte` which has the same philosophy and nearly identical API as React Testing Library (`render`, `screen`, `fireEvent`, `waitFor`) but works with Svelte components. Do NOT import from `@testing-library/react`.

---

## Plan Structure

The plan is split into two phases:

### Phase 1: Vertical Slice (Tasks 1-5)
Prove ALL core infrastructure works end-to-end before building any features. By the end of Phase 1 you can: enter a GitHub PAT, create a note, see it saved to GitHub, reload the page and see it rehydrated from IndexedDB, and verify the service worker caches assets for offline use. This single flow touches every critical system: SvelteKit routing, GitHub API, IndexedDB cache, sync engine, service worker, and basic UI. **Every task includes integration tests, type checks, lint, and format checks.**

### Phase 2: Feature Build-Out (Tasks 6-13)
With the plumbing proven, build the full app: sidebar, folder navigation, editor polish, YouTube embeds, voice dictation, mobile layout, keyboard shortcuts, daily notes, deployment, E2E tests, and final polish.

---

## File Structure

```
src/
├── app.html                          # HTML shell with PWA meta tags
├── app.css                           # Global CSS: Catppuccin tokens, reset, typography
├── service-worker.ts                 # PWA service worker (asset caching)
├── lib/
│   ├── stores/
│   │   ├── notes.svelte.ts           # Note CRUD state ($state runes)
│   │   └── ui.svelte.ts              # UI state (sidebar open, active view)
│   ├── github.ts                     # GitHub REST API client (CRUD files)
│   ├── cache.ts                      # IndexedDB read/write via idb-keyval
│   ├── sync.ts                       # Sync engine: offline queue, push on reconnect
│   ├── types.ts                      # Shared TypeScript types
│   ├── youtube.ts                    # YouTube URL detection + embed helpers
│   └── components/
│       ├── Sidebar.svelte            # Sidebar: search, pinned, folder tree, trash
│       ├── FolderTree.svelte         # Recursive folder tree
│       ├── NoteList.svelte           # List of notes in a folder (mobile + desktop)
│       ├── Editor.svelte             # Note editor: title, content, toolbar
│       ├── EditorToolbar.svelte      # Toolbar: mic, star, delete, move
│       ├── TodoItem.svelte           # Single checkbox todo line
│       ├── YouTubeEmbed.svelte       # Embedded YouTube player
│       ├── SearchBar.svelte          # Search input + results dropdown
│       ├── MicButton.svelte          # Voice dictation push-to-talk button
│       └── SaveIndicator.svelte      # "Saved" fade indicator
├── routes/
│   ├── +layout.svelte                # Root layout: sidebar + main area
│   ├── +layout.ts                    # Disable SSR/prerender (client-only SPA)
│   ├── +page.svelte                  # Home: redirect to inbox or daily note
│   ├── setup/
│   │   └── +page.svelte              # First-run: enter GitHub PAT + repo name
│   └── [folder]/
│       ├── +page.svelte              # Folder view: note list
│       └── [note]/
│           └── +page.svelte          # Note editor view
static/
├── manifest.json                     # PWA manifest
├── icon-192.png                      # PWA icon 192x192
├── icon-512.png                      # PWA icon 512x512
└── .nojekyll                         # Disable Jekyll on GitHub Pages
tests/
├── factories.ts                      # Test data factories: createTestNote(), etc.
├── setup.ts                          # Global test setup: idb-keyval mock, fetch helpers
├── integration/
│   ├── github-client.test.ts         # GitHub API (fetch mocked, logic real)
│   ├── sync-engine.test.ts           # Sync engine (real cache + mocked GitHub)
│   ├── setup-page.test.ts            # Setup page component rendering + validation
│   ├── note-creation.test.ts         # Create note: click → store → UI updates
│   ├── note-editor.test.ts           # Editor: type → auto-save → content synced
│   ├── folder-nav.test.ts            # Sidebar + folder tree + note list
│   ├── search.test.ts               # Search bar: query → filtered results
│   ├── youtube-embed.test.ts         # YouTube URL detection + embed rendering
│   └── todo-toggle.test.ts           # Todo checkbox toggle + content update
└── e2e/                              # Added in Phase 2 once base app works
    ├── setup.test.ts                 # Setup flow e2e
    ├── notes.test.ts                 # Create/edit/delete notes e2e
    └── navigation.test.ts            # Folder nav + search e2e
```

---

# PHASE 1: VERTICAL SLICE — Prove the Infrastructure

> **Goal:** By the end of Task 5, you have a working app where you can enter a GitHub PAT, create a note in the browser, see it appear as a file in your GitHub repo, reload the page and see it rehydrated from IndexedDB, and confirm the service worker is caching assets. This is the foundation everything else builds on.

---

## Task 1: Project Scaffolding + Quality Toolchain

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/app.css`
- Create: `static/manifest.json`, `static/.nojekyll`
- Create: `src/routes/+layout.svelte`, `src/routes/+layout.ts`, `src/routes/+page.svelte`
- Create: `src/lib/types.ts`
- Create: `eslint.config.js`, `.prettierrc`, `.prettierignore`
- Create: `tests/setup.ts`, `tests/factories.ts`

- [ ] **Step 1: Scaffold SvelteKit project**

```bash
cd /Users/yogeshkumar/Documents/snap-crackle-pop/MyLife
npx sv create . --template minimal --types ts
```

Accept defaults. When prompted about additional options, select ESLint and Prettier if offered. If prompted about existing files, allow overwrite (only README.md exists).

- [ ] **Step 2: Install core dependencies**

```bash
npm install
npm install -D @sveltejs/adapter-static
npm install idb-keyval
```

- [ ] **Step 3: Install testing dependencies**

```bash
npm install -D vitest @testing-library/svelte @testing-library/jest-dom jsdom @testing-library/user-event
```

- [ ] **Step 4: Install linting + formatting (if not already added by sv create)**

```bash
npm install -D eslint prettier eslint-config-prettier eslint-plugin-svelte @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier-plugin-svelte
```

Skip any packages that `sv create` already installed.

- [ ] **Step 5: Configure static adapter**

Replace the contents of `svelte.config.js`:

```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: '404.html'
    }),
    paths: {
      base: process.argv.includes('dev') ? '' : process.env.BASE_PATH || ''
    }
  }
};

export default config;
```

- [ ] **Step 6: Configure Vitest with jsdom + testing-library**

Replace `vite.config.ts`:

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    globals: true
  }
});
```

- [ ] **Step 7: Create global test setup**

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';

// In-memory mock for idb-keyval — used by ALL tests.
// This gives us a real key-value store without needing IndexedDB in jsdom.
const store = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  del: vi.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
  keys: vi.fn(() => Promise.resolve([...store.keys()]))
}));

// Reset store between tests
beforeEach(() => {
  store.clear();
});

// Export for tests that need direct store access
export { store };
```

- [ ] **Step 8: Create test factories**

Create `tests/factories.ts`:

```typescript
import type { Note, Folder, SyncQueueItem, AppConfig } from '$lib/types';

let noteCounter = 0;

export function createTestNote(overrides: Partial<Note> = {}): Note {
  noteCounter++;
  return {
    path: `inbox/note-${noteCounter}.md`,
    title: `Test Note ${noteCounter}`,
    content: `Content of note ${noteCounter}`,
    type: 'text',
    pinned: false,
    updatedAt: new Date().toISOString(),
    sha: `sha-${noteCounter}`,
    ...overrides
  };
}

export function createTestTodo(overrides: Partial<Note> = {}): Note {
  return createTestNote({
    type: 'todo',
    content: `Todo List\n\n- [ ] First task\n- [ ] Second task\n- [x] Done task`,
    ...overrides
  });
}

export function createTestFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    path: 'inbox',
    name: 'inbox',
    children: [],
    ...overrides
  };
}

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    token: 'ghp_test-token-123',
    repo: 'testuser/mylife-notes',
    ...overrides
  };
}

export function createTestSyncItem(overrides: Partial<SyncQueueItem> = {}): SyncQueueItem {
  return {
    action: 'create',
    path: 'inbox/new.md',
    content: 'New note content',
    queuedAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Creates a mock fetch that responds to GitHub API calls.
 * Use this instead of manually crafting mockFetch responses.
 */
export function createMockFetch() {
  return vi.fn();
}

/**
 * Helper to create a successful GitHub API response.
 */
export function githubResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data
  };
}

/**
 * Helper to create a failed GitHub API response.
 */
export function githubError(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText
  };
}
```

- [ ] **Step 9: Configure Prettier**

Create `.prettierrc`:

```json
{
  "useTabs": true,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [
    {
      "files": "*.svelte",
      "options": {
        "parser": "svelte"
      }
    }
  ]
}
```

Create `.prettierignore`:

```
build/
.svelte-kit/
node_modules/
```

- [ ] **Step 10: Configure ESLint**

Create `eslint.config.js` (flat config format):

```javascript
import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettier,
  ...svelte.configs['flat/recommended'],
  ...svelte.configs['flat/prettier'],
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        extraFileExtensions: ['.svelte']
      }
    },
    plugins: {
      '@typescript-eslint': ts
    },
    rules: {
      ...ts.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    ignores: ['build/', '.svelte-kit/', 'node_modules/']
  }
];
```

Note: The `sv create` scaffolder may generate its own ESLint config. If so, adapt it rather than overwriting — the key requirements are: TypeScript strict rules, Svelte plugin, and Prettier integration.

- [ ] **Step 11: Add npm scripts**

Update `package.json` scripts (merge with whatever `sv create` generates):

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --check .",
    "format:fix": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "validate": "npm run check && npm run lint && npm run format && npm run test"
  }
}
```

- [ ] **Step 12: Disable SSR (client-only SPA)**

Create `src/routes/+layout.ts`:

```typescript
export const prerender = false;
export const ssr = false;
```

- [ ] **Step 13: Create shared types**

Create `src/lib/types.ts`:

```typescript
export interface Note {
  /** File path in GitHub repo, e.g. "inbox/my-note.md" */
  path: string;
  /** Display title (derived from first line or filename) */
  title: string;
  /** Full text content */
  content: string;
  /** Note type */
  type: 'text' | 'todo';
  /** Whether this note is pinned/favorited */
  pinned: boolean;
  /** ISO timestamp of last edit */
  updatedAt: string;
  /** GitHub file SHA (needed for updates via API) */
  sha: string;
}

export interface Folder {
  /** Folder path in repo, e.g. "work" */
  path: string;
  /** Display name */
  name: string;
  /** Child folders */
  children: Folder[];
}

export interface SyncQueueItem {
  /** Type of operation */
  action: 'create' | 'update' | 'delete';
  /** File path in repo */
  path: string;
  /** File content (for create/update) */
  content?: string;
  /** GitHub file SHA (for update/delete) */
  sha?: string;
  /** ISO timestamp when queued */
  queuedAt: string;
}

export interface AppConfig {
  /** GitHub Personal Access Token */
  token: string;
  /** GitHub repo in "owner/repo" format */
  repo: string;
}
```

- [ ] **Step 14: Create global CSS with Catppuccin Mocha tokens**

Replace `src/app.css`:

```css
:root {
  --bg-base: #1e1e2e;
  --bg-surface: #181825;
  --bg-overlay: #11111b;
  --border: #313244;
  --text-primary: #cdd6f4;
  --text-secondary: #a6adc8;
  --text-muted: #585b70;
  --accent: #89b4fa;
  --accent-hover: #74c7ec;
  --danger: #f38ba8;
  --success: #a6e3a1;
  --warning: #f9e2af;
  --radius: 6px;
  --sidebar-width: 260px;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', monospace;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  font-family: var(--font-sans);
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--accent);
  text-decoration: none;
}

a:hover {
  color: var(--accent-hover);
}

button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: inherit;
}

input, textarea {
  font-family: inherit;
  font-size: inherit;
  color: var(--text-primary);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 12px;
  outline: none;
}

input:focus, textarea:focus {
  border-color: var(--accent);
}

::selection {
  background: var(--accent);
  color: var(--bg-base);
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
```

- [ ] **Step 15: Create PWA manifest and static assets**

Create `static/manifest.json`:

```json
{
  "name": "MyLife",
  "short_name": "MyLife",
  "description": "Personal second brain",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1e1e2e",
  "theme_color": "#1e1e2e",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

```bash
touch static/.nojekyll static/icon-192.png static/icon-512.png
```

- [ ] **Step 16: Add PWA meta tags to app.html**

Replace `src/app.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <meta name="theme-color" content="#1e1e2e" />
    <meta name="description" content="MyLife — Personal second brain" />
    <link rel="manifest" href="%sveltekit.assets%/manifest.json" />
    <link rel="icon" href="%sveltekit.assets%/icon-192.png" />
    <link rel="apple-touch-icon" href="%sveltekit.assets%/icon-192.png" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 17: Create minimal root layout and home page**

Replace `src/routes/+layout.svelte`:

```svelte
<script>
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

Replace `src/routes/+page.svelte`:

```svelte
<h1>MyLife</h1>
<p style="color: var(--text-muted)">Infrastructure verification in progress...</p>
```

- [ ] **Step 18: Verify app builds and runs**

```bash
npm run dev -- --open
```

Expected: Browser opens, dark background (#1e1e2e), "MyLife" heading visible in light text.

```bash
npm run build
```

Expected: Build succeeds, output in `build/` directory.

- [ ] **Step 19: Run the full validation pipeline**

```bash
npm run validate
```

Expected: Type checks pass, ESLint clean, Prettier clean, tests pass (no tests yet, but the runner should succeed with 0 tests). Fix any lint/format issues before proceeding.

If `validate` isn't wired up yet (depends on `sv create` output), run each individually:

```bash
npm run check && npm run lint && npm run format && npm run test
```

- [ ] **Step 20: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit project with quality toolchain (TS strict, ESLint, Prettier, Vitest + testing-library)"
```

---

## Task 2: GitHub API Client + IndexedDB Cache (with integration tests)

**Why together:** These are the two data layers. We need both to prove the vertical slice — GitHub for persistence, IndexedDB for local cache. Testing them together proves the integration before Task 3 (sync engine) wires them.

**Files:**
- Create: `src/lib/github.ts`
- Create: `src/lib/cache.ts`
- Create: `tests/integration/github-client.test.ts`

- [ ] **Step 1: Write failing integration tests for GitHub API client + cache**

Create `tests/integration/github-client.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubClient } from '$lib/github';
import { NoteCache } from '$lib/cache';
import { createMockFetch, githubResponse, githubError, createTestNote } from '../factories';

// Only mock the network boundary — fetch. Everything else is real.
const mockFetch = createMockFetch();
vi.stubGlobal('fetch', mockFetch);

describe('GitHub API Client', () => {
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient('fake-token', 'testuser/mylife-notes');
    mockFetch.mockReset();
  });

  it('lists files from repo tree, filtering to blobs only', async () => {
    mockFetch.mockResolvedValueOnce(githubResponse({
      tree: [
        { path: 'inbox/note1.md', type: 'blob', sha: 'abc123' },
        { path: 'inbox', type: 'tree', sha: 'def456' },
        { path: 'work/task.md', type: 'blob', sha: 'ghi789' }
      ]
    }));

    const files = await client.listFiles();

    expect(files).toEqual([
      { path: 'inbox/note1.md', sha: 'abc123' },
      { path: 'work/task.md', sha: 'ghi789' }
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/git/trees/main?recursive=1'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer fake-token' })
      })
    );
  });

  it('fetches and decodes base64 file content', async () => {
    mockFetch.mockResolvedValueOnce(githubResponse({
      content: btoa('Hello world'),
      sha: 'abc123'
    }));

    const result = await client.getFileContent('inbox/note1.md');
    expect(result).toEqual({ content: 'Hello world', sha: 'abc123' });
  });

  it('creates a file and returns new sha', async () => {
    mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'new-sha' } }));

    const sha = await client.createFile('inbox/new.md', 'Note content');

    expect(sha).toBe('new-sha');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/contents/inbox/new.md');
    expect(opts.method).toBe('PUT');
  });

  it('updates a file with existing sha', async () => {
    mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'updated-sha' } }));

    const sha = await client.updateFile('inbox/note.md', 'Updated', 'old-sha');

    expect(sha).toBe('updated-sha');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sha).toBe('old-sha');
  });

  it('deletes a file', async () => {
    mockFetch.mockResolvedValueOnce(githubResponse({}));

    await client.deleteFile('inbox/old.md', 'abc123');

    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('throws on API errors', async () => {
    mockFetch.mockResolvedValueOnce(githubError(404, 'Not Found'));

    await expect(client.listFiles()).rejects.toThrow('GitHub API error: 404 Not Found');
  });
});

describe('GitHub Client + IndexedDB Cache integration', () => {
  let client: GitHubClient;
  let cache: NoteCache;

  beforeEach(() => {
    client = new GitHubClient('fake-token', 'testuser/mylife-notes');
    cache = new NoteCache();
    mockFetch.mockReset();
  });

  it('fetches a file from GitHub and caches it locally', async () => {
    mockFetch.mockResolvedValueOnce(githubResponse({
      content: btoa('My note content'),
      sha: 'file-sha'
    }));

    const { content, sha } = await client.getFileContent('inbox/test.md');
    const note = createTestNote({ path: 'inbox/test.md', content, sha });
    await cache.saveNote(note);

    // Verify round-trip through cache
    const cached = await cache.getNote('inbox/test.md');
    expect(cached?.content).toBe('My note content');
    expect(cached?.sha).toBe('file-sha');
  });

  it('cache persists multiple notes and lists them', async () => {
    const note1 = createTestNote({ path: 'inbox/a.md' });
    const note2 = createTestNote({ path: 'work/b.md' });

    await cache.saveNote(note1);
    await cache.saveNote(note2);

    const all = await cache.getAllNotes();
    expect(all).toHaveLength(2);
    expect(all.map(n => n.path)).toContain('inbox/a.md');
    expect(all.map(n => n.path)).toContain('work/b.md');
  });

  it('cache deletes a note', async () => {
    const note = createTestNote({ path: 'inbox/del.md' });
    await cache.saveNote(note);
    await cache.deleteNote('inbox/del.md');

    const result = await cache.getNote('inbox/del.md');
    expect(result).toBeUndefined();
  });

  it('cache saves and retrieves app config', async () => {
    await cache.saveConfig({ token: 'ghp_test', repo: 'user/repo' });
    const config = await cache.getConfig();
    expect(config).toEqual({ token: 'ghp_test', repo: 'user/repo' });
  });

  it('cache saves and retrieves sync queue', async () => {
    const queue = [{ action: 'create' as const, path: 'inbox/new.md', content: 'hi', queuedAt: new Date().toISOString() }];
    await cache.saveSyncQueue(queue);
    const retrieved = await cache.getSyncQueue();
    expect(retrieved).toEqual(queue);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/integration/github-client.test.ts
```

Expected: FAIL — `Cannot find module '$lib/github'`

- [ ] **Step 3: Implement GitHub API client**

Create `src/lib/github.ts`:

```typescript
interface GitHubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
}

export interface GitHubFile {
  path: string;
  sha: string;
}

export class GitHubClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(token: string, repo: string) {
    this.baseUrl = `https://api.github.com/repos/${repo}`;
    this.headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...options, headers: this.headers });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async listFiles(): Promise<GitHubFile[]> {
    const data = await this.request<{ tree: GitHubTreeEntry[] }>(
      `${this.baseUrl}/git/trees/main?recursive=1`
    );
    return data.tree
      .filter((entry) => entry.type === 'blob')
      .map(({ path, sha }) => ({ path, sha }));
  }

  async getFileContent(path: string): Promise<{ content: string; sha: string }> {
    const data = await this.request<{ content: string; sha: string }>(
      `${this.baseUrl}/contents/${path}`
    );
    return {
      content: atob(data.content.replace(/\n/g, '')),
      sha: data.sha
    };
  }

  async createFile(path: string, content: string): Promise<string> {
    const data = await this.request<{ content: { sha: string } }>(
      `${this.baseUrl}/contents/${path}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          message: `Create ${path}`,
          content: btoa(content)
        })
      }
    );
    return data.content.sha;
  }

  async updateFile(path: string, content: string, sha: string): Promise<string> {
    const data = await this.request<{ content: { sha: string } }>(
      `${this.baseUrl}/contents/${path}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          message: `Update ${path}`,
          content: btoa(content),
          sha
        })
      }
    );
    return data.content.sha;
  }

  async deleteFile(path: string, sha: string): Promise<void> {
    await this.request(
      `${this.baseUrl}/contents/${path}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          message: `Delete ${path}`,
          sha
        })
      }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they still fail (need cache)**

```bash
npm run test -- tests/integration/github-client.test.ts
```

Expected: FAIL — GitHub client tests pass, cache integration tests fail (`Cannot find module '$lib/cache'`).

- [ ] **Step 5: Implement IndexedDB cache layer**

Create `src/lib/cache.ts`:

```typescript
import { get, set, del, keys } from 'idb-keyval';
import type { Note, SyncQueueItem } from './types';

const NOTE_PREFIX = 'note:';
const SYNC_QUEUE_KEY = 'sync-queue';
const CONFIG_KEY = 'app-config';

export class NoteCache {
  async saveNote(note: Note): Promise<void> {
    await set(`${NOTE_PREFIX}${note.path}`, note);
  }

  async getNote(path: string): Promise<Note | undefined> {
    return get<Note>(`${NOTE_PREFIX}${path}`);
  }

  async getAllNotes(): Promise<Note[]> {
    const allKeys = await keys();
    const noteKeys = allKeys.filter((k) => String(k).startsWith(NOTE_PREFIX));
    const notes: Note[] = [];
    for (const key of noteKeys) {
      const note = await get<Note>(key);
      if (note) notes.push(note);
    }
    return notes;
  }

  async deleteNote(path: string): Promise<void> {
    await del(`${NOTE_PREFIX}${path}`);
  }

  async saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
    await set(SYNC_QUEUE_KEY, queue);
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return (await get<SyncQueueItem[]>(SYNC_QUEUE_KEY)) ?? [];
  }

  async saveConfig(config: { token: string; repo: string }): Promise<void> {
    await set(CONFIG_KEY, config);
  }

  async getConfig(): Promise<{ token: string; repo: string } | undefined> {
    return get(CONFIG_KEY);
  }
}
```

- [ ] **Step 6: Run all tests to verify they pass**

```bash
npm run test
```

Expected: All 11 tests PASS (6 GitHub client + 5 cache integration).

- [ ] **Step 7: Run full validation**

```bash
npm run validate
```

Expected: Type checks, lint, format, and tests all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/github.ts src/lib/cache.ts tests/integration/github-client.test.ts
git commit -m "feat: add GitHub API client and IndexedDB cache with integration tests"
```

---

## Task 3: Sync Engine (wires GitHub + Cache together)

**Why now:** The sync engine is the bridge. It pulls from GitHub into IndexedDB and pushes offline changes back. We need this before the UI can create a note and have it round-trip.

**Testing approach:** Sync engine uses a REAL NoteCache (backed by the in-memory idb-keyval mock from `tests/setup.ts`). Only the GitHub API client's fetch calls are mocked — this is the network boundary.

**Files:**
- Create: `src/lib/sync.ts`
- Create: `tests/integration/sync-engine.test.ts`

- [ ] **Step 1: Write failing integration tests for sync engine**

Create `tests/integration/sync-engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SyncEngine } from '$lib/sync';
import { GitHubClient } from '$lib/github';
import { NoteCache } from '$lib/cache';
import { createMockFetch, githubResponse, createTestSyncItem } from '../factories';

// Mock only the network boundary
const mockFetch = createMockFetch();
vi.stubGlobal('fetch', mockFetch);

describe('SyncEngine', () => {
  let github: GitHubClient;
  let cache: NoteCache; // REAL cache, backed by in-memory idb-keyval
  let sync: SyncEngine;

  beforeEach(() => {
    mockFetch.mockReset();
    github = new GitHubClient('fake-token', 'testuser/mylife-notes');
    cache = new NoteCache();
    sync = new SyncEngine(github, cache);
  });

  describe('fullSync', () => {
    it('fetches files from GitHub, caches them, and returns Notes', async () => {
      // Mock: listFiles (tree endpoint)
      mockFetch.mockResolvedValueOnce(githubResponse({
        tree: [
          { path: 'inbox/note.md', type: 'blob', sha: 'abc' },
          { path: 'inbox', type: 'tree', sha: 'dir' }
        ]
      }));
      // Mock: getFileContent
      mockFetch.mockResolvedValueOnce(githubResponse({
        content: btoa('Hello world'), sha: 'abc'
      }));

      const notes = await sync.fullSync();

      expect(notes).toHaveLength(1);
      expect(notes[0].path).toBe('inbox/note.md');
      expect(notes[0].content).toBe('Hello world');
      expect(notes[0].title).toBe('Hello world');

      // Verify it was cached (real IndexedDB)
      const cached = await cache.getNote('inbox/note.md');
      expect(cached?.content).toBe('Hello world');
    });

    it('derives title from # heading', async () => {
      mockFetch.mockResolvedValueOnce(githubResponse({
        tree: [{ path: 'work/task.md', type: 'blob', sha: 'x' }]
      }));
      mockFetch.mockResolvedValueOnce(githubResponse({
        content: btoa('# My Task\nSome details'), sha: 'x'
      }));

      const notes = await sync.fullSync();
      expect(notes[0].title).toBe('My Task');
    });

    it('detects todo type from checkbox syntax', async () => {
      mockFetch.mockResolvedValueOnce(githubResponse({
        tree: [{ path: 'inbox/todos.md', type: 'blob', sha: 'y' }]
      }));
      mockFetch.mockResolvedValueOnce(githubResponse({
        content: btoa('Shopping\n- [ ] Milk\n- [x] Eggs'), sha: 'y'
      }));

      const notes = await sync.fullSync();
      expect(notes[0].type).toBe('todo');
    });
  });

  describe('pushOfflineQueue', () => {
    it('processes queued create operations and clears the queue', async () => {
      // Seed the queue in real cache
      await cache.saveSyncQueue([
        createTestSyncItem({ action: 'create', path: 'inbox/new.md', content: 'New note' })
      ]);
      mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'new-sha' } }));

      await sync.pushOfflineQueue();

      // Verify GitHub was called
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('/contents/inbox/new.md');

      // Verify queue was cleared
      const queue = await cache.getSyncQueue();
      expect(queue).toEqual([]);
    });

    it('keeps failed items in queue for retry', async () => {
      await cache.saveSyncQueue([
        createTestSyncItem({ action: 'create', path: 'inbox/ok.md', content: 'ok' }),
        createTestSyncItem({ action: 'create', path: 'inbox/fail.md', content: 'fail' })
      ]);
      mockFetch
        .mockResolvedValueOnce(githubResponse({ content: { sha: 'sha1' } }))
        .mockRejectedValueOnce(new Error('network error'));

      await sync.pushOfflineQueue();

      const queue = await cache.getSyncQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].path).toBe('inbox/fail.md');
    });

    it('does nothing when queue is empty', async () => {
      await sync.pushOfflineQueue();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/integration/sync-engine.test.ts
```

Expected: FAIL — `Cannot find module '$lib/sync'`

- [ ] **Step 3: Implement sync engine**

Create `src/lib/sync.ts`:

```typescript
import type { GitHubClient } from './github';
import type { NoteCache } from './cache';
import type { Note, SyncQueueItem } from './types';

function titleFromContent(content: string, path: string): string {
  const firstLine = content.split('\n')[0]?.trim();
  if (firstLine) return firstLine.replace(/^#\s*/, '');
  const filename = path.split('/').pop() ?? path;
  return filename.replace(/\.md$/, '');
}

function detectType(content: string): 'text' | 'todo' {
  return content.includes('- [ ]') || content.includes('- [x]') ? 'todo' : 'text';
}

export class SyncEngine {
  constructor(
    private github: GitHubClient,
    private cache: NoteCache
  ) {}

  async fullSync(): Promise<Note[]> {
    const files = await this.github.listFiles();
    const mdFiles = files.filter((f) => f.path.endsWith('.md'));
    const notes: Note[] = [];

    for (const file of mdFiles) {
      const { content, sha } = await this.github.getFileContent(file.path);
      const note: Note = {
        path: file.path,
        title: titleFromContent(content, file.path),
        content,
        type: detectType(content),
        pinned: false,
        updatedAt: new Date().toISOString(),
        sha
      };
      await this.cache.saveNote(note);
      notes.push(note);
    }

    return notes;
  }

  async pushOfflineQueue(): Promise<void> {
    const queue = await this.cache.getSyncQueue();
    if (queue.length === 0) return;

    const remaining: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        switch (item.action) {
          case 'create':
            await this.github.createFile(item.path, item.content ?? '');
            break;
          case 'update':
            await this.github.updateFile(item.path, item.content ?? '', item.sha ?? '');
            break;
          case 'delete':
            await this.github.deleteFile(item.path, item.sha ?? '');
            break;
        }
      } catch {
        remaining.push(item);
      }
    }

    await this.cache.saveSyncQueue(remaining);
  }
}
```

- [ ] **Step 4: Run all tests + validation**

```bash
npm run validate
```

Expected: All integration tests pass. Type checks, lint, format clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.ts tests/integration/sync-engine.test.ts
git commit -m "feat: add sync engine with real cache integration tests"
```

---

## Task 4: Setup Page + Minimal Notes Store (first UI touching real infra)

**Why now:** We have GitHub client, cache, and sync engine — all tested with integration tests. Now we wire them into a real UI. The setup page lets the user enter their PAT and repo. The notes store manages state using Svelte 5 runes and delegates to the sync engine. This is where we prove the browser can talk to GitHub.

**Testing approach:** Test the setup page by rendering it with `@testing-library/svelte` and asserting what the user sees — form fields, validation, button states. Test notes store utility functions (createSlug, buildFolderTree) as they're pure functions used by multiple components.

**Files:**
- Create: `src/lib/stores/notes.svelte.ts`
- Create: `src/lib/stores/ui.svelte.ts`
- Create: `src/routes/setup/+page.svelte`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`
- Create: `tests/integration/setup-page.test.ts`
- Create: `tests/integration/note-creation.test.ts`

- [ ] **Step 1: Write failing integration tests**

Create `tests/integration/setup-page.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SetupPage from '../../src/routes/setup/+page.svelte';
import { createMockFetch, githubResponse, githubError } from '../factories';

const mockFetch = createMockFetch();
vi.stubGlobal('fetch', mockFetch);

// Mock SvelteKit navigation
vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

describe('Setup Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('renders the setup form with token and repo fields', () => {
    render(SetupPage);

    expect(screen.getByText('MyLife')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ghp_/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/username\//)).toBeInTheDocument();
  });

  it('disables connect button when fields are empty', () => {
    render(SetupPage);

    const button = screen.getByRole('button', { name: /connect/i });
    expect(button).toBeDisabled();
  });

  it('enables connect button when both fields are filled', async () => {
    const user = userEvent.setup();
    render(SetupPage);

    await user.type(screen.getByPlaceholderText(/ghp_/), 'ghp_test123');
    await user.type(screen.getByPlaceholderText(/username\//), 'user/repo');

    const button = screen.getByRole('button', { name: /connect/i });
    expect(button).not.toBeDisabled();
  });

  it('shows error message on failed connection', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(githubError(401, 'Unauthorized'));

    render(SetupPage);

    await user.type(screen.getByPlaceholderText(/ghp_/), 'bad-token');
    await user.type(screen.getByPlaceholderText(/username\//), 'user/repo');
    await user.click(screen.getByRole('button', { name: /connect/i }));

    // Wait for error to appear
    expect(await screen.findByText(/GitHub API error/)).toBeInTheDocument();
  });
});
```

Create `tests/integration/note-creation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createSlug, buildFolderTree } from '$lib/stores/notes.svelte';

describe('createSlug', () => {
  it('converts title to lowercase hyphenated slug', () => {
    expect(createSlug('My Cool Note')).toBe('my-cool-note');
  });

  it('strips special characters', () => {
    expect(createSlug('Hello, World! #1')).toBe('hello-world-1');
  });

  it('trims leading/trailing hyphens', () => {
    expect(createSlug('  --hello--  ')).toBe('hello');
  });

  it('collapses multiple hyphens', () => {
    expect(createSlug('foo   bar')).toBe('foo-bar');
  });
});

describe('buildFolderTree', () => {
  it('builds tree from note paths', () => {
    const paths = [
      'inbox/note1.md',
      'inbox/note2.md',
      'work/project/deep.md',
      'work/task.md',
      'daily/2026-03-29.md'
    ];

    const tree = buildFolderTree(paths);

    expect(tree.map(f => f.name)).toContain('inbox');
    expect(tree.map(f => f.name)).toContain('work');
    expect(tree.map(f => f.name)).toContain('daily');

    const work = tree.find(f => f.name === 'work')!;
    expect(work.children).toHaveLength(1);
    expect(work.children[0].name).toBe('project');
  });

  it('returns empty array for no paths', () => {
    expect(buildFolderTree([])).toEqual([]);
  });

  it('sorts folders alphabetically', () => {
    const tree = buildFolderTree(['zebra/a.md', 'alpha/b.md']);
    expect(tree[0].name).toBe('alpha');
    expect(tree[1].name).toBe('zebra');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `Cannot find module '$lib/stores/notes.svelte'`

- [ ] **Step 3: Implement notes store**

Create `src/lib/stores/notes.svelte.ts`:

```typescript
import type { Note, Folder, SyncQueueItem } from '$lib/types';
import { GitHubClient } from '$lib/github';
import { NoteCache } from '$lib/cache';
import { SyncEngine } from '$lib/sync';

// --- Pure utility functions (exported for testing) ---

export function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildFolderTree(paths: string[]): Folder[] {
  const folderSet = new Map<string, Folder>();

  for (const path of paths) {
    const parts = path.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join('/');
      if (!folderSet.has(folderPath)) {
        folderSet.set(folderPath, {
          path: folderPath,
          name: parts[i],
          children: []
        });
      }
    }
  }

  const roots: Folder[] = [];
  for (const folder of folderSet.values()) {
    const parentPath = folder.path.split('/').slice(0, -1).join('/');
    const parent = folderSet.get(parentPath);
    if (parent) {
      if (!parent.children.find(c => c.path === folder.path)) {
        parent.children.push(folder);
      }
    } else {
      roots.push(folder);
    }
  }

  return roots.sort((a, b) => a.name.localeCompare(b.name));
}

// --- Reactive store ---

let notes = $state<Note[]>([]);
let loading = $state(false);
let initialized = $state(false);

let github: GitHubClient | null = null;
let cache = new NoteCache();
let sync: SyncEngine | null = null;

export function initStore(token: string, repo: string) {
  github = new GitHubClient(token, repo);
  sync = new SyncEngine(github, cache);
}

export function getNotes() {
  return notes;
}

export function isLoading() {
  return loading;
}

export function isInitialized() {
  return initialized;
}

export async function loadNotes() {
  loading = true;
  try {
    const cached = await cache.getAllNotes();
    if (cached.length > 0) {
      notes = cached;
      initialized = true;
    }

    if (navigator.onLine && sync) {
      await sync.pushOfflineQueue();
      const synced = await sync.fullSync();
      notes = synced;
    }

    initialized = true;
  } finally {
    loading = false;
  }
}

export async function createNote(folder: string, title: string, type: 'text' | 'todo'): Promise<Note> {
  const slug = createSlug(title) || 'untitled';
  const path = `${folder}/${slug}.md`;
  const content = type === 'todo' ? `${title}\n\n- [ ] ` : title;
  const now = new Date().toISOString();

  const note: Note = {
    path,
    title,
    content,
    type,
    pinned: false,
    updatedAt: now,
    sha: ''
  };

  if (navigator.onLine && github) {
    note.sha = await github.createFile(path, content);
  } else {
    const queue = await cache.getSyncQueue();
    queue.push({ action: 'create', path, content, queuedAt: now });
    await cache.saveSyncQueue(queue);
  }

  await cache.saveNote(note);
  notes = [...notes, note];
  return note;
}

export async function updateNote(path: string, content: string) {
  const idx = notes.findIndex(n => n.path === path);
  if (idx === -1) return;

  const existing = notes[idx];
  const now = new Date().toISOString();
  const updated: Note = {
    ...existing,
    content,
    title: content.split('\n')[0]?.trim().replace(/^#\s*/, '') || existing.title,
    type: content.includes('- [ ]') || content.includes('- [x]') ? 'todo' : 'text',
    updatedAt: now
  };

  if (navigator.onLine && github) {
    updated.sha = await github.updateFile(path, content, existing.sha);
  } else {
    const queue = await cache.getSyncQueue();
    queue.push({ action: 'update', path, content, sha: existing.sha, queuedAt: now });
    await cache.saveSyncQueue(queue);
  }

  await cache.saveNote(updated);
  notes = notes.map(n => n.path === path ? updated : n);
}

export async function deleteNote(path: string) {
  const note = notes.find(n => n.path === path);
  if (!note) return;

  const trashPath = `.trash/${path.split('/').pop()}`;
  const now = new Date().toISOString();

  if (navigator.onLine && github) {
    await github.createFile(trashPath, note.content);
    await github.deleteFile(path, note.sha);
  } else {
    const queue = await cache.getSyncQueue();
    queue.push({ action: 'create', path: trashPath, content: note.content, queuedAt: now });
    queue.push({ action: 'delete', path, sha: note.sha, queuedAt: now });
    await cache.saveSyncQueue(queue);
  }

  const trashedNote: Note = { ...note, path: trashPath, updatedAt: now };
  await cache.deleteNote(path);
  await cache.saveNote(trashedNote);
  notes = notes.filter(n => n.path !== path);
  notes = [...notes, trashedNote];
}

export async function togglePin(path: string) {
  const note = notes.find(n => n.path === path);
  if (!note) return;
  const updated = { ...note, pinned: !note.pinned };
  await cache.saveNote(updated);
  notes = notes.map(n => n.path === path ? updated : n);
}

export function getNotesInFolder(folder: string): Note[] {
  return notes.filter(n => {
    const dir = n.path.substring(0, n.path.lastIndexOf('/'));
    return dir === folder;
  });
}

export function getPinnedNotes(): Note[] {
  return notes.filter(n => n.pinned);
}

export function getFolderTree(): Folder[] {
  return buildFolderTree(notes.map(n => n.path));
}
```

- [ ] **Step 4: Create UI state store**

Create `src/lib/stores/ui.svelte.ts`:

```typescript
let sidebarOpen = $state(true);
let sidebarCollapsed = $state(false);

export function getSidebarOpen() {
  return sidebarOpen;
}

export function setSidebarOpen(open: boolean) {
  sidebarOpen = open;
}

export function getSidebarCollapsed() {
  return sidebarCollapsed;
}

export function toggleSidebarCollapsed() {
  sidebarCollapsed = !sidebarCollapsed;
}
```

- [ ] **Step 5: Run integration tests to verify store tests pass**

```bash
npm run test -- tests/integration/note-creation.test.ts
```

Expected: All 7 tests PASS (4 createSlug + 3 buildFolderTree).

- [ ] **Step 6: Create setup page**

Create `src/routes/setup/+page.svelte`:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { NoteCache } from '$lib/cache';
  import { GitHubClient } from '$lib/github';

  let token = $state('');
  let repo = $state('');
  let error = $state('');
  let testing = $state(false);

  async function handleSubmit() {
    error = '';
    testing = true;

    try {
      const client = new GitHubClient(token, repo);
      await client.listFiles();

      const cache = new NoteCache();
      await cache.saveConfig({ token, repo });

      goto('/');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Connection failed. Check your token and repo name.';
    } finally {
      testing = false;
    }
  }
</script>

<div class="setup">
  <div class="setup-card">
    <h1>MyLife</h1>
    <p class="subtitle">Connect your GitHub repo to get started.</p>

    <form onsubmit={handleSubmit}>
      <label>
        <span>GitHub Personal Access Token</span>
        <input
          type="password"
          bind:value={token}
          placeholder="ghp_xxxxxxxxxxxx"
          required
        />
        <span class="hint">Needs "repo" scope for private repo access.</span>
      </label>

      <label>
        <span>Repository</span>
        <input
          type="text"
          bind:value={repo}
          placeholder="username/mylife-notes"
          required
        />
        <span class="hint">Format: owner/repo-name</span>
      </label>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <button type="submit" disabled={testing || !token || !repo}>
        {testing ? 'Testing connection...' : 'Connect'}
      </button>
    </form>
  </div>
</div>

<style>
  .setup {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
  }

  .setup-card {
    max-width: 420px;
    width: 100%;
  }

  h1 {
    font-size: 28px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .subtitle {
    color: var(--text-secondary);
    margin-bottom: 32px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label span:first-child {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .hint {
    font-size: 12px;
    color: var(--text-muted);
  }

  .error {
    color: var(--danger);
    font-size: 13px;
  }

  button[type="submit"] {
    background: var(--accent);
    color: var(--bg-base);
    padding: 10px 20px;
    border-radius: var(--radius);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 0.15s;
  }

  button[type="submit"]:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  button[type="submit"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

- [ ] **Step 7: Update root layout to check config and init store**

Replace `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { NoteCache } from '$lib/cache';
  import { initStore, loadNotes } from '$lib/stores/notes.svelte';
  import { onMount } from 'svelte';

  let { children } = $props();
  let checking = $state(true);
  let authenticated = $state(false);

  onMount(async () => {
    const cache = new NoteCache();
    const config = await cache.getConfig();

    if (!config) {
      if (!page.url.pathname.includes('/setup')) {
        goto('/setup');
      }
      checking = false;
      return;
    }

    initStore(config.token, config.repo);
    await loadNotes();
    authenticated = true;
    checking = false;
  });
</script>

{#if checking}
  <div class="loading">
    <p>Loading...</p>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: var(--text-muted);
  }
</style>
```

- [ ] **Step 8: Update home page with a minimal "create note" button**

Replace `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { getNotes, createNote } from '$lib/stores/notes.svelte';

  let notes = $derived(getNotes());
  let creating = $state(false);
  let message = $state('');

  async function handleCreateNote() {
    creating = true;
    message = '';
    try {
      const note = await createNote('inbox', 'My first note', 'text');
      message = `Note created! Path: ${note.path}, SHA: ${note.sha}`;
    } catch (e) {
      message = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    } finally {
      creating = false;
    }
  }
</script>

<div style="padding: 40px; max-width: 600px;">
  <h1>MyLife</h1>
  <p style="color: var(--text-secondary); margin: 8px 0 24px;">Infrastructure verification</p>

  <button
    onclick={handleCreateNote}
    disabled={creating}
    style="background: var(--accent); color: var(--bg-base); padding: 10px 20px; border-radius: var(--radius); font-weight: 600; font-size: 14px;"
  >
    {creating ? 'Creating...' : 'Create Test Note in Inbox'}
  </button>

  {#if message}
    <p style="margin-top: 16px; font-size: 13px; color: var(--success);">{message}</p>
  {/if}

  <h2 style="margin-top: 32px; font-size: 16px; color: var(--text-secondary);">
    Cached Notes ({notes.length})
  </h2>

  {#if notes.length === 0}
    <p style="color: var(--text-muted); font-size: 14px;">No notes yet. Create one above, then reload to verify rehydration.</p>
  {:else}
    <ul style="list-style: none; margin-top: 12px;">
      {#each notes as note}
        <li style="padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px;">
          <strong>{note.title}</strong>
          <span style="color: var(--text-muted); font-size: 12px; margin-left: 8px;">{note.path}</span>
          <span style="color: var(--text-muted); font-size: 11px; margin-left: 8px;">sha: {note.sha.slice(0, 7)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

- [ ] **Step 9: Run full validation**

```bash
npm run validate
```

Expected: All integration tests pass. Type checks, lint, format clean.

- [ ] **Step 10: Commit**

```bash
git add src/lib/stores/notes.svelte.ts src/lib/stores/ui.svelte.ts src/routes/setup/+page.svelte src/routes/+layout.svelte src/routes/+page.svelte tests/integration/setup-page.test.ts tests/integration/note-creation.test.ts
git commit -m "feat: add setup page, notes store, and integration tests for creation flow"
```

---

## Task 5: Service Worker + End-to-End Infrastructure Verification

**Why this is the milestone:** This is the "prove it all works" task. We add the service worker for offline caching, then manually verify the complete vertical slice: setup → create note → see it in GitHub → reload → rehydrated from IndexedDB → service worker caching assets.

**Files:**
- Create: `src/service-worker.ts`

- [ ] **Step 1: Create service worker**

Create `src/service-worker.ts`:

```typescript
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const sw = globalThis.self as unknown as ServiceWorkerGlobalScope;
const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
});

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const url = new URL(event.request.url);
      const cache = await caches.open(CACHE);

      if (ASSETS.includes(url.pathname)) {
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
      }

      try {
        const response = await fetch(event.request);
        if (response.status === 200) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw new Error('Offline and no cache available');
      }
    })()
  );
});
```

- [ ] **Step 2: Build and verify service worker is in output**

```bash
npm run build
ls build/service-worker.js
```

Expected: `build/service-worker.js` exists.

- [ ] **Step 3: Run full validation**

```bash
npm run validate
```

Expected: All integration tests pass. Type checks, lint, format clean.

- [ ] **Step 4: Manual end-to-end infrastructure verification**

Run the app in preview mode (production build):

```bash
npm run preview
```

**Verification checklist — do each step manually:**

1. **Setup flow:** Open `http://localhost:4173`. Verify redirect to `/setup`. Enter your GitHub PAT and repo name (e.g., `yogeshkumar/mylife-notes`). Click Connect. Verify redirect to `/`.

2. **Create a note:** On the home page, click "Create Test Note in Inbox". Verify green success message with path and SHA.

3. **GitHub verification:** Open your GitHub repo in a browser. Verify `inbox/my-first-note.md` exists with content "My first note".

4. **Note list:** Verify the "Cached Notes" section shows the note with title, path, and sha.

5. **Rehydration (IndexedDB):** Hard reload the page (Ctrl+Shift+R). Verify the note still appears in the list — this proves IndexedDB caching works.

6. **Service worker:** Open DevTools → Application → Service Workers. Verify a service worker is registered and active. Check the Cache Storage — verify `cache-*` contains app assets.

7. **Offline test:** In DevTools → Network, check "Offline". Reload the page. Verify the app shell loads (from service worker cache). The note list should appear (from IndexedDB). Creating a new note should queue it locally.

- [ ] **Step 5: Commit**

```bash
git add src/service-worker.ts
git commit -m "feat: add service worker — Phase 1 vertical slice complete

All core infrastructure verified:
- GitHub API: create/read/update/delete files
- IndexedDB: cache and rehydrate notes
- Sync engine: online push + offline queue
- Service worker: PWA offline asset caching
- Setup flow: PAT configuration and validation"
```

---

# PHASE 2: FEATURE BUILD-OUT

> **Prerequisite:** Phase 1 must be complete and verified. All core infrastructure is proven. Now we build the real app on top of it.

---

## Task 6: Sidebar + Folder Navigation

**Files:**
- Create: `src/lib/components/Sidebar.svelte`
- Create: `src/lib/components/FolderTree.svelte`
- Create: `src/lib/components/SearchBar.svelte`
- Create: `src/routes/[folder]/+page.svelte`
- Create: `src/lib/components/NoteList.svelte`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Create SearchBar component**

Create `src/lib/components/SearchBar.svelte`:

```svelte
<script lang="ts">
  import { getNotes } from '$lib/stores/notes.svelte';
  import { goto } from '$app/navigation';

  let query = $state('');
  let results = $derived.by(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return getNotes()
      .filter(n => !n.path.startsWith('.trash/'))
      .filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
      .slice(0, 10);
  });
  let open = $state(false);

  function select(path: string) {
    const folder = path.substring(0, path.lastIndexOf('/'));
    const note = path.split('/').pop()?.replace('.md', '');
    goto(`/${folder}/${note}`);
    query = '';
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      query = '';
      open = false;
    }
  }
</script>

<div class="search-wrapper">
  <input
    type="text"
    placeholder="Search notes..."
    bind:value={query}
    onfocus={() => open = true}
    onkeydown={handleKeydown}
    class="search-input"
  />
  {#if open && results.length > 0}
    <ul class="search-results">
      {#each results as note}
        <li>
          <button onclick={() => select(note.path)}>
            <span class="result-title">{note.title}</span>
            <span class="result-path">{note.path}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search-wrapper {
    position: relative;
    padding: 0 12px;
    margin-bottom: 12px;
  }

  .search-input {
    width: 100%;
    padding: 6px 10px;
    font-size: 13px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-base);
  }

  .search-results {
    position: absolute;
    top: 100%;
    left: 12px;
    right: 12px;
    background: var(--bg-overlay);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    max-height: 300px;
    overflow-y: auto;
    z-index: 100;
    list-style: none;
  }

  .search-results button {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 8px 12px;
    text-align: left;
    gap: 2px;
  }

  .search-results button:hover {
    background: var(--border);
  }

  .result-title {
    font-size: 13px;
    color: var(--text-primary);
  }

  .result-path {
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
```

- [ ] **Step 2: Create FolderTree component**

Create `src/lib/components/FolderTree.svelte`:

```svelte
<script lang="ts">
  import type { Folder } from '$lib/types';
  import { page } from '$app/state';

  interface Props {
    folders: Folder[];
    depth?: number;
  }

  let { folders, depth = 0 }: Props = $props();

  function isActive(path: string): boolean {
    return page.url.pathname.includes(`/${path}`);
  }
</script>

<ul class="folder-tree" style:padding-left="{depth * 16}px">
  {#each folders as folder}
    <li>
      <a href="/{folder.path}" class="folder-link" class:active={isActive(folder.path)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span>{folder.name}</span>
      </a>
      {#if folder.children.length > 0}
        <svelte:self folders={folder.children} depth={depth + 1} />
      {/if}
    </li>
  {/each}
</ul>

<style>
  .folder-tree {
    list-style: none;
  }

  .folder-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    border-radius: var(--radius);
    text-decoration: none;
  }

  .folder-link:hover {
    background: var(--border);
    color: var(--text-primary);
  }

  .folder-link.active {
    color: var(--text-primary);
    background: var(--border);
  }

  svg {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .folder-link.active svg {
    color: var(--accent);
  }
</style>
```

- [ ] **Step 3: Create Sidebar component**

Create `src/lib/components/Sidebar.svelte`:

```svelte
<script lang="ts">
  import SearchBar from './SearchBar.svelte';
  import FolderTree from './FolderTree.svelte';
  import { getFolderTree, getPinnedNotes, createNote } from '$lib/stores/notes.svelte';
  import { getSidebarCollapsed, toggleSidebarCollapsed } from '$lib/stores/ui.svelte';
  import { goto } from '$app/navigation';

  let folders = $derived(getFolderTree());
  let pinned = $derived(getPinnedNotes());
  let collapsed = $derived(getSidebarCollapsed());

  async function newNote() {
    const note = await createNote('inbox', 'Untitled', 'text');
    const name = note.path.split('/').pop()?.replace('.md', '');
    goto(`/inbox/${name}`);
  }

  async function newTodo() {
    const note = await createNote('inbox', 'Untitled Todo', 'todo');
    const name = note.path.split('/').pop()?.replace('.md', '');
    goto(`/inbox/${name}`);
  }

  function goToDaily() {
    const today = new Date().toISOString().split('T')[0];
    goto(`/daily/${today}`);
  }
</script>

<aside class="sidebar" class:collapsed>
  <div class="sidebar-header">
    <h1 class="app-title">MyLife</h1>
    <button class="collapse-btn" onclick={toggleSidebarCollapsed} aria-label="Toggle sidebar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12h18M3 6h18M3 18h18"/>
      </svg>
    </button>
  </div>

  {#if !collapsed}
    <div class="quick-actions">
      <button onclick={newNote} class="action-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Note
      </button>
      <button onclick={newTodo} class="action-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        Todo
      </button>
    </div>

    <SearchBar />

    <button onclick={goToDaily} class="daily-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
      Daily Note
    </button>

    {#if pinned.length > 0}
      <div class="section">
        <h2 class="section-title">Pinned</h2>
        <ul class="pinned-list">
          {#each pinned as note}
            {@const folder = note.path.substring(0, note.path.lastIndexOf('/'))}
            {@const name = note.path.split('/').pop()?.replace('.md', '')}
            <li>
              <a href="/{folder}/{name}" class="pinned-link">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                {note.title}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="section">
      <h2 class="section-title">Folders</h2>
      <FolderTree {folders} />
    </div>

    <div class="section trash-section">
      <a href="/.trash" class="trash-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Trash
      </a>
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    height: 100vh;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
    transition: width 0.2s;
  }

  .sidebar.collapsed {
    width: 48px;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 12px 8px;
  }

  .app-title {
    font-size: 18px;
    font-weight: 700;
  }

  .collapsed .app-title {
    display: none;
  }

  .collapse-btn {
    padding: 4px;
    color: var(--text-muted);
    border-radius: var(--radius);
  }

  .collapse-btn:hover {
    color: var(--text-primary);
    background: var(--border);
  }

  .quick-actions {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    flex: 1;
    justify-content: center;
  }

  .action-btn:hover {
    background: var(--border);
    color: var(--text-primary);
  }

  .daily-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    margin: 0 12px 8px;
    font-size: 13px;
    color: var(--text-secondary);
    border-radius: var(--radius);
  }

  .daily-btn:hover {
    background: var(--border);
    color: var(--text-primary);
  }

  .section {
    padding: 8px 0;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 4px 12px;
  }

  .pinned-list {
    list-style: none;
  }

  .pinned-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    text-decoration: none;
  }

  .pinned-link:hover {
    background: var(--border);
    color: var(--text-primary);
  }

  .pinned-link svg {
    color: var(--warning);
    flex-shrink: 0;
  }

  .trash-section {
    margin-top: auto;
    border-top: 1px solid var(--border);
    padding: 8px 0;
  }

  .trash-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
  }

  .trash-link:hover {
    color: var(--danger);
    background: var(--border);
  }
</style>
```

- [ ] **Step 4: Create NoteList component**

Create `src/lib/components/NoteList.svelte`:

```svelte
<script lang="ts">
  import type { Note } from '$lib/types';

  interface Props {
    notes: Note[];
    folder: string;
  }

  let { notes, folder }: Props = $props();

  let sorted = $derived(
    [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  );

  function getPreview(content: string): string {
    const lines = content.split('\n').filter(l => l.trim());
    return lines[1]?.trim().slice(0, 80) || lines[0]?.trim().slice(0, 80) || 'Empty note';
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function noteUrl(note: Note): string {
    const name = note.path.split('/').pop()?.replace('.md', '');
    return `/${folder}/${name}`;
  }
</script>

<div class="note-list">
  {#each sorted as note (note.path)}
    <a href={noteUrl(note)} class="note-item">
      <div class="note-item-header">
        <span class="note-title">{note.title}</span>
        {#if note.pinned}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" class="pin-icon">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        {/if}
      </div>
      <div class="note-meta">
        <span class="note-preview">{getPreview(note.content)}</span>
        <span class="note-date">{formatDate(note.updatedAt)}</span>
      </div>
    </a>
  {/each}

  {#if sorted.length === 0}
    <p class="empty">No notes in this folder yet.</p>
  {/if}
</div>

<style>
  .note-list {
    display: flex;
    flex-direction: column;
  }

  .note-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: inherit;
  }

  .note-item:hover {
    background: var(--bg-surface);
    margin: 0 -12px;
    padding: 12px;
    border-radius: var(--radius);
    border-bottom-color: transparent;
  }

  .note-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .note-title {
    font-size: 14px;
    font-weight: 500;
  }

  .pin-icon {
    color: var(--warning);
  }

  .note-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .note-preview {
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .note-date {
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .empty {
    color: var(--text-muted);
    font-size: 14px;
    padding: 40px 0;
    text-align: center;
  }
</style>
```

- [ ] **Step 5: Create folder route page**

Create `src/routes/[folder]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { getNotesInFolder, createNote } from '$lib/stores/notes.svelte';
  import { goto } from '$app/navigation';
  import NoteList from '$lib/components/NoteList.svelte';

  let folder = $derived(page.params.folder);
  let notes = $derived(getNotesInFolder(folder));

  async function quickNote() {
    const note = await createNote(folder, 'Untitled', 'text');
    const name = note.path.split('/').pop()?.replace('.md', '');
    goto(`/${folder}/${name}`);
  }
</script>

<div class="folder-view">
  <div class="folder-header">
    <h1>{folder}</h1>
    <button onclick={quickNote} class="new-note-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    </button>
  </div>

  <NoteList {notes} {folder} />
</div>

<style>
  .folder-view {
    max-width: 640px;
  }

  .folder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 22px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .new-note-btn {
    padding: 6px;
    color: var(--text-muted);
    border-radius: var(--radius);
    border: 1px solid var(--border);
  }

  .new-note-btn:hover {
    color: var(--text-primary);
    background: var(--border);
  }
</style>
```

- [ ] **Step 6: Update layout to show sidebar when authenticated**

Replace `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { NoteCache } from '$lib/cache';
  import { initStore, loadNotes } from '$lib/stores/notes.svelte';
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';

  let { children } = $props();
  let checking = $state(true);
  let authenticated = $state(false);

  onMount(async () => {
    const cache = new NoteCache();
    const config = await cache.getConfig();

    if (!config) {
      if (!page.url.pathname.includes('/setup')) {
        goto('/setup');
      }
      checking = false;
      return;
    }

    initStore(config.token, config.repo);
    await loadNotes();
    authenticated = true;
    checking = false;
  });
</script>

{#if checking}
  <div class="loading">
    <p>Loading...</p>
  </div>
{:else if authenticated}
  <div class="app-shell">
    <Sidebar />
    <main class="main-content">
      {@render children()}
    </main>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: var(--text-muted);
  }

  .app-shell {
    display: flex;
    height: 100vh;
  }

  .main-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
  }

  @media (max-width: 768px) {
    .main-content {
      padding: 16px;
    }
  }
</style>
```

- [ ] **Step 7: Update home page to redirect to inbox**

Replace `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/inbox');
  });
</script>
```

- [ ] **Step 8: Verify sidebar and folder navigation works**

```bash
npm run dev
```

Expected: After setup, sidebar shows with app title, + Note / + Todo buttons, search, folder tree, and trash. Clicking a folder shows the note list. Creating a note from sidebar navigates to the folder.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/Sidebar.svelte src/lib/components/FolderTree.svelte src/lib/components/SearchBar.svelte src/lib/components/NoteList.svelte src/routes/\[folder\]/+page.svelte src/routes/+layout.svelte src/routes/+page.svelte
git commit -m "feat: add sidebar with search, folder tree, and note list view"
```

---

## Task 7: Note Editor (auto-save, todos, toolbar)

**Files:**
- Create: `src/lib/components/Editor.svelte`
- Create: `src/lib/components/EditorToolbar.svelte`
- Create: `src/lib/components/SaveIndicator.svelte`
- Create: `src/lib/components/TodoItem.svelte`
- Create: `src/routes/[folder]/[note]/+page.svelte`

- [ ] **Step 1: Create SaveIndicator, TodoItem, EditorToolbar, Editor components**

Create `src/lib/components/SaveIndicator.svelte`:

```svelte
<script lang="ts">
  interface Props { visible: boolean; }
  let { visible }: Props = $props();
</script>

<span class="save-indicator" class:visible>Saved</span>

<style>
  .save-indicator {
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 0.3s;
  }
  .save-indicator.visible {
    opacity: 1;
  }
</style>
```

Create `src/lib/components/TodoItem.svelte`:

```svelte
<script lang="ts">
  interface Props {
    checked: boolean;
    text: string;
    onToggle: () => void;
    onTextChange: (text: string) => void;
  }

  let { checked, text, onToggle, onTextChange }: Props = $props();
</script>

<div class="todo-item">
  <button class="checkbox" class:checked onclick={onToggle} aria-label={checked ? 'Uncheck' : 'Check'}>
    {#if checked}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    {/if}
  </button>
  <input
    type="text"
    value={text}
    oninput={(e) => onTextChange(e.currentTarget.value)}
    class="todo-text"
    class:done={checked}
  />
</div>

<style>
  .todo-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }

  .checkbox {
    width: 18px;
    height: 18px;
    border: 1.5px solid var(--border);
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--accent);
  }

  .checkbox.checked {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg-base);
  }

  .todo-text {
    flex: 1;
    border: none;
    padding: 2px 0;
    font-size: 14px;
    background: transparent;
  }

  .todo-text:focus {
    border: none;
    outline: none;
  }

  .todo-text.done {
    text-decoration: line-through;
    color: var(--text-muted);
  }
</style>
```

Create `src/lib/components/EditorToolbar.svelte`:

```svelte
<script lang="ts">
  interface Props {
    pinned: boolean;
    onTogglePin: () => void;
    onDelete: () => void;
  }

  let { pinned, onTogglePin, onDelete }: Props = $props();
</script>

<div class="toolbar">
  <button onclick={onTogglePin} class="tool-btn" class:active={pinned} aria-label={pinned ? 'Unpin' : 'Pin'}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  </button>

  <button onclick={onDelete} class="tool-btn danger" aria-label="Delete note">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  </button>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tool-btn {
    padding: 6px;
    color: var(--text-muted);
    border-radius: var(--radius);
  }

  .tool-btn:hover {
    color: var(--text-primary);
    background: var(--border);
  }

  .tool-btn.active {
    color: var(--warning);
  }

  .tool-btn.danger:hover {
    color: var(--danger);
  }
</style>
```

Create `src/lib/components/Editor.svelte`:

```svelte
<script lang="ts">
  import type { Note } from '$lib/types';
  import { updateNote, deleteNote, togglePin } from '$lib/stores/notes.svelte';
  import { goto } from '$app/navigation';
  import EditorToolbar from './EditorToolbar.svelte';
  import SaveIndicator from './SaveIndicator.svelte';
  import TodoItem from './TodoItem.svelte';

  interface Props {
    note: Note;
  }

  let { note }: Props = $props();

  let content = $state(note.content);
  let showSaved = $state(false);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleInput() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      await updateNote(note.path, content);
      showSaved = true;
      setTimeout(() => showSaved = false, 1500);
    }, 800);
  }

  async function handleDelete() {
    const folder = note.path.substring(0, note.path.lastIndexOf('/'));
    await deleteNote(note.path);
    goto(`/${folder}`);
  }

  async function handleTogglePin() {
    await togglePin(note.path);
  }

  function parseTodos(text: string): Array<{ checked: boolean; text: string }> {
    return text.split('\n')
      .filter(line => line.match(/^- \[[ x]\] /))
      .map(line => ({
        checked: line.startsWith('- [x]'),
        text: line.replace(/^- \[[ x]\] /, '')
      }));
  }

  function toggleTodo(index: number) {
    const lines = content.split('\n');
    let todoIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^- \[[ x]\] /)) {
        if (todoIdx === index) {
          lines[i] = lines[i].startsWith('- [x]')
            ? lines[i].replace('- [x]', '- [ ]')
            : lines[i].replace('- [ ]', '- [x]');
          break;
        }
        todoIdx++;
      }
    }
    content = lines.join('\n');
    handleInput();
  }

  function updateTodoText(index: number, newText: string) {
    const lines = content.split('\n');
    let todoIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^- \[[ x]\] /)) {
        if (todoIdx === index) {
          const prefix = lines[i].startsWith('- [x]') ? '- [x] ' : '- [ ] ';
          lines[i] = prefix + newText;
          break;
        }
        todoIdx++;
      }
    }
    content = lines.join('\n');
    handleInput();
  }

  let todos = $derived(note.type === 'todo' ? parseTodos(content) : []);
  let breadcrumb = $derived(note.path.replace('.md', '').replace(/\//g, ' / '));
</script>

<div class="editor">
  <div class="editor-header">
    <div class="editor-meta">
      <span class="breadcrumb">{breadcrumb}</span>
      <SaveIndicator visible={showSaved} />
    </div>
    <EditorToolbar
      pinned={note.pinned}
      onTogglePin={handleTogglePin}
      onDelete={handleDelete}
    />
  </div>

  {#if note.type === 'todo'}
    <div class="todo-editor">
      <h2 class="note-title">{note.title}</h2>
      {#each todos as todo, i}
        <TodoItem
          checked={todo.checked}
          text={todo.text}
          onToggle={() => toggleTodo(i)}
          onTextChange={(text) => updateTodoText(i, text)}
        />
      {/each}
    </div>
  {:else}
    <textarea
      bind:value={content}
      oninput={handleInput}
      class="text-editor"
      placeholder="Start writing..."
    ></textarea>
  {/if}
</div>

<style>
  .editor {
    max-width: 720px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 12px;
  }

  .editor-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .breadcrumb {
    font-size: 12px;
    color: var(--text-muted);
  }

  .note-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .text-editor {
    flex: 1;
    resize: none;
    border: none;
    font-size: 15px;
    line-height: 1.7;
    background: transparent;
    color: var(--text-primary);
    padding: 0;
  }

  .text-editor:focus {
    border: none;
    outline: none;
  }

  .todo-editor {
    flex: 1;
  }
</style>
```

- [ ] **Step 2: Create note route page**

Create `src/routes/[folder]/[note]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { getNotes } from '$lib/stores/notes.svelte';
  import Editor from '$lib/components/Editor.svelte';

  let folder = $derived(page.params.folder);
  let noteName = $derived(page.params.note);
  let notePath = $derived(`${folder}/${noteName}.md`);
  let note = $derived(getNotes().find(n => n.path === notePath));
</script>

{#if note}
  <Editor {note} />
{:else}
  <div class="not-found">
    <p>Note not found.</p>
    <a href="/{folder}">Back to {folder}</a>
  </div>
{/if}

<style>
  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 60px 0;
    color: var(--text-muted);
  }
</style>
```

- [ ] **Step 3: Verify editor works end-to-end**

```bash
npm run dev
```

Expected: Create a note → navigate to it → editor renders with textarea, breadcrumb, pin/delete toolbar. Type text → "Saved" indicator appears after 800ms. Verify in GitHub that file content updated.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Editor.svelte src/lib/components/EditorToolbar.svelte src/lib/components/SaveIndicator.svelte src/lib/components/TodoItem.svelte src/routes/\[folder\]/\[note\]/+page.svelte
git commit -m "feat: add note editor with auto-save, todo support, and pin/delete toolbar"
```

---

## Task 8: YouTube Embed

**Files:**
- Create: `src/lib/youtube.ts`
- Create: `src/lib/components/YouTubeEmbed.svelte`
- Create: `tests/integration/youtube-embed.test.ts`
- Modify: `src/lib/components/Editor.svelte`

- [ ] **Step 1: Write failing tests for YouTube URL parsing**

Create `tests/integration/youtube-embed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { extractYouTubeId, findYouTubeUrls } from '$lib/youtube';
import YouTubeEmbed from '$lib/components/YouTubeEmbed.svelte';

describe('YouTube URL parsing', () => {
  it('extracts ID from standard watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from embed URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube URL', () => {
    expect(extractYouTubeId('https://example.com')).toBeNull();
  });

  it('finds multiple YouTube URLs in note content', () => {
    const text = 'Check out https://www.youtube.com/watch?v=abc123 and https://youtu.be/def456';
    expect(findYouTubeUrls(text)).toEqual(['abc123', 'def456']);
  });

  it('returns empty array for text without YouTube URLs', () => {
    expect(findYouTubeUrls('no urls here')).toEqual([]);
  });
});

describe('YouTubeEmbed component', () => {
  it('renders an iframe with the correct embed URL', () => {
    render(YouTubeEmbed, { props: { videoId: 'dQw4w9WgXcQ' } });

    const iframe = screen.getByTitle('YouTube video');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/integration/youtube-embed.test.ts
```

Expected: FAIL — `Cannot find module '$lib/youtube'`

- [ ] **Step 3: Implement YouTube helpers**

Create `src/lib/youtube.ts`:

```typescript
export function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : null;
}

export function findYouTubeUrls(text: string): string[] {
  const ids: string[] = [];
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/integration/youtube-embed.test.ts
```

Expected: All 7 tests PASS (6 URL parsing + 1 component render).

- [ ] **Step 5: Create YouTubeEmbed component**

Create `src/lib/components/YouTubeEmbed.svelte`:

```svelte
<script lang="ts">
  interface Props { videoId: string; }
  let { videoId }: Props = $props();
</script>

<div class="youtube-embed">
  <iframe
    src="https://www.youtube.com/embed/{videoId}"
    title="YouTube video"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
  ></iframe>
</div>

<style>
  .youtube-embed {
    position: relative;
    padding-bottom: 56.25%;
    height: 0;
    margin: 16px 0;
    border-radius: var(--radius);
    overflow: hidden;
  }

  iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
```

- [ ] **Step 6: Update Editor to render YouTube embeds**

Add imports to `src/lib/components/Editor.svelte`:

```typescript
import { findYouTubeUrls } from '$lib/youtube';
import YouTubeEmbed from './YouTubeEmbed.svelte';
```

Add derived value:

```typescript
let youtubeIds = $derived(findYouTubeUrls(content));
```

Add before closing `</div>` of `.editor`:

```svelte
{#if youtubeIds.length > 0}
  <div class="embeds">
    {#each youtubeIds as id}
      <YouTubeEmbed videoId={id} />
    {/each}
  </div>
{/if}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/youtube.ts src/lib/components/YouTubeEmbed.svelte tests/integration/youtube-embed.test.ts src/lib/components/Editor.svelte
git commit -m "feat: add YouTube URL detection and embedded player in notes"
```

---

## Task 9: Voice Dictation (Web Speech API)

**Files:**
- Create: `src/lib/components/MicButton.svelte`
- Create: `src/app.d.ts`
- Modify: `src/lib/components/EditorToolbar.svelte`
- Modify: `src/lib/components/Editor.svelte`

- [ ] **Step 1: Create Web Speech API type declarations**

Create `src/app.d.ts`:

```typescript
declare global {
  namespace App {}

  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export {};
```

- [ ] **Step 2: Create MicButton component**

Create `src/lib/components/MicButton.svelte`:

```svelte
<script lang="ts">
  interface Props {
    onResult: (text: string) => void;
  }

  let { onResult }: Props = $props();

  let recording = $state(false);
  let supported = $state(false);
  let recognition: SpeechRecognition | null = null;

  $effect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    supported = !!SpeechRecognition;
    if (supported) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
        recording = false;
      };

      recognition.onerror = () => { recording = false; };
      recognition.onend = () => { recording = false; };
    }
  });

  function toggle() {
    if (!recognition) return;
    if (recording) {
      recognition.stop();
      recording = false;
    } else {
      recognition.start();
      recording = true;
    }
  }
</script>

{#if supported}
  <button class="mic-btn" class:recording onclick={toggle} aria-label={recording ? 'Stop recording' : 'Start dictation'}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill={recording ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
    {#if recording}
      <span class="pulse"></span>
    {/if}
  </button>
{/if}

<style>
  .mic-btn {
    position: relative;
    padding: 6px;
    color: var(--text-muted);
    border-radius: 50%;
  }

  .mic-btn:hover {
    color: var(--text-primary);
    background: var(--border);
  }

  .mic-btn.recording {
    color: var(--danger);
  }

  .pulse {
    position: absolute;
    inset: -2px;
    border: 2px solid var(--danger);
    border-radius: 50%;
    animation: pulse 1.5s ease-out infinite;
  }

  @keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.5); }
  }
</style>
```

- [ ] **Step 3: Update EditorToolbar to include mic and dictation callback**

Replace `src/lib/components/EditorToolbar.svelte`:

```svelte
<script lang="ts">
  import MicButton from './MicButton.svelte';

  interface Props {
    pinned: boolean;
    onTogglePin: () => void;
    onDelete: () => void;
    onDictation: (text: string) => void;
  }

  let { pinned, onTogglePin, onDelete, onDictation }: Props = $props();
</script>

<div class="toolbar">
  <MicButton onResult={onDictation} />

  <button onclick={onTogglePin} class="tool-btn" class:active={pinned} aria-label={pinned ? 'Unpin' : 'Pin'}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  </button>

  <button onclick={onDelete} class="tool-btn danger" aria-label="Delete note">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  </button>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tool-btn {
    padding: 6px;
    color: var(--text-muted);
    border-radius: var(--radius);
  }

  .tool-btn:hover {
    color: var(--text-primary);
    background: var(--border);
  }

  .tool-btn.active {
    color: var(--warning);
  }

  .tool-btn.danger:hover {
    color: var(--danger);
  }
</style>
```

- [ ] **Step 4: Update Editor to handle dictation**

In `src/lib/components/Editor.svelte`, add dictation handler:

```typescript
function handleDictation(text: string) {
  content = content + (content.endsWith('\n') || content === '' ? '' : ' ') + text;
  handleInput();
}
```

Update EditorToolbar usage:

```svelte
<EditorToolbar
  pinned={note.pinned}
  onTogglePin={handleTogglePin}
  onDelete={handleDelete}
  onDictation={handleDictation}
/>
```

- [ ] **Step 5: Verify dictation works**

```bash
npm run dev
```

Expected: Mic button in toolbar. Click to start recording (red pulse). Speak, release — text appends to note.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/MicButton.svelte src/lib/components/EditorToolbar.svelte src/lib/components/Editor.svelte src/app.d.ts
git commit -m "feat: add voice dictation with Web Speech API"
```

---

## Task 10: Mobile Layout + Keyboard Shortcuts + Daily Notes

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/lib/components/Editor.svelte`
- Modify: `src/lib/stores/notes.svelte.ts`
- Create: `src/routes/daily/[date]/+page.svelte`

- [ ] **Step 1: Add mobile responsive layout to root layout**

Update `src/routes/+layout.svelte` to add mobile overlay, hamburger menu, and keyboard shortcuts. Replace the authenticated block and add mobile state + keyboard handler as described in the spec (sidebar overlay on mobile, Ctrl+N/Ctrl+Shift+N/Ctrl+K shortcuts).

- [ ] **Step 2: Add mobile bottom mic bar to Editor**

Add a fixed bottom bar with MicButton that only shows on mobile (`@media (max-width: 768px)`).

- [ ] **Step 3: Add daily note helper to store**

Add to `src/lib/stores/notes.svelte.ts`:

```typescript
export async function getOrCreateDailyNote(): Promise<Note> {
  const today = new Date().toISOString().split('T')[0];
  const path = `daily/${today}.md`;
  const existing = notes.find(n => n.path === path);
  if (existing) return existing;
  return createNote('daily', today, 'text');
}
```

- [ ] **Step 4: Create daily note route**

Create `src/routes/daily/[date]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { getNotes, getOrCreateDailyNote } from '$lib/stores/notes.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import { onMount } from 'svelte';

  let date = $derived(page.params.date);
  let notePath = $derived(`daily/${date}.md`);
  let note = $derived(getNotes().find(n => n.path === notePath));

  onMount(async () => {
    const today = new Date().toISOString().split('T')[0];
    if (date === today && !note) {
      await getOrCreateDailyNote();
    }
  });
</script>

{#if note}
  <Editor {note} />
{:else}
  <div class="loading-note">
    <p>Creating daily note...</p>
  </div>
{/if}

<style>
  .loading-note {
    color: var(--text-muted);
    padding: 40px 0;
    text-align: center;
  }
</style>
```

- [ ] **Step 5: Verify mobile layout and daily notes**

```bash
npm run dev
```

Test in Chrome DevTools mobile view. Verify sidebar overlay, hamburger menu, bottom mic bar. Click "Daily Note" in sidebar — verify it auto-creates today's note.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+layout.svelte src/lib/components/Editor.svelte src/lib/stores/notes.svelte.ts src/routes/daily/\[date\]/+page.svelte
git commit -m "feat: add mobile layout, keyboard shortcuts, and daily notes"
```

---

## Task 11: GitHub Actions Deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create GitHub Actions workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: 'main'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  build_site:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          BASE_PATH: '/${{ github.event.repository.name }}'
        run: npm run build

      - name: Upload Artifacts
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'build/'

  deploy:
    needs: build_site
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions workflow for GitHub Pages deployment"
```

---

## Task 12: E2E Tests with Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/setup.test.ts`
- Create: `tests/e2e/notes.test.ts`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create Playwright config**

Create `playwright.config.ts`:

```typescript
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI
  },
  testDir: 'tests/e2e',
  testMatch: '**/*.test.ts',
  use: {
    baseURL: 'http://localhost:4173'
  }
};

export default config;
```

- [ ] **Step 3: Create E2E tests**

Create `tests/e2e/setup.test.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('redirects to setup page when no config exists', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/setup/);
  await expect(page.locator('h1')).toHaveText('MyLife');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('input[type="text"]')).toBeVisible();
});

test('connect button is disabled when fields are empty', async ({ page }) => {
  await page.goto('/setup');
  await expect(page.locator('button[type="submit"]')).toBeDisabled();
});
```

Create `tests/e2e/notes.test.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('setup page has correct form elements', async ({ page }) => {
  await page.goto('/setup');
  await expect(page.locator('input[placeholder*="ghp_"]')).toBeVisible();
  await expect(page.locator('input[placeholder*="username/"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});
```

- [ ] **Step 4: Run E2E tests**

```bash
npx playwright test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/setup.test.ts tests/e2e/notes.test.ts
git commit -m "test: add Playwright E2E tests for setup flow"
```

---

## Task 13: Final Polish + Build Verification

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore**

Add:

```
.svelte-kit/
test-results/
playwright-report/
```

- [ ] **Step 2: Run full validation pipeline**

```bash
npm run validate
```

Expected: Type checks pass, ESLint clean, Prettier clean, all integration tests pass.

- [ ] **Step 3: Run E2E tests**

```bash
npx playwright test
```

Expected: All E2E tests pass.

- [ ] **Step 4: Verify production build**

```bash
npm run build && npm run preview
```

Expected: App loads, dark theme, setup flow works, service worker active.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final polish — all validation, integration tests, and E2E passing"
```
