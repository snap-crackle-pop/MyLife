# URL Routing for Folder Selection

**Date:** 2026-04-01  
**Status:** Approved

## Problem

The selected folder is stored in in-memory `$state` in `ui.svelte.ts`. Refreshing the page loses it. The user wants the last-visited folder preserved — with a clean URL.

## Approach

Add a SvelteKit catch-all route `src/routes/[...path]/+page.svelte`. The selected folder becomes entirely URL-driven. No separate `selectedFolder` state is needed.

This works on GitHub Pages because `svelte.config.js` already sets `fallback: '404.html'`, so deep links are handled without extra configuration.

## Architecture

### New route

`src/routes/[...path]/+page.svelte` receives `params.path` (e.g. `"work/projects"`) from SvelteKit. It passes this as the `selectedFolder` prop to the existing page content (currently in `src/routes/+page.svelte`).

### Root route

`src/routes/+page.svelte` becomes the empty/home state — shown when no folder is selected ("Select a folder or create one to get started.").

### Route grouping

Both pages (root and `[...path]`) need the Sidebar and mobile header. A SvelteKit route group `(app)` is the clean solution:

```
src/routes/
  (app)/
    +layout.svelte      ← Sidebar, mobile header, app shell
    +page.svelte        ← empty state (no folder selected)
    [...path]/
      +page.svelte      ← folder view (FolderPanel)
  setup/
    +page.svelte        ← unchanged, outside the group
  +layout.svelte        ← auth check, initStore, loadNotes (unchanged)
  +layout.ts            ← ssr=false, prerender=false (unchanged)
```

The `(app)/+layout.svelte` contains the Sidebar, drawer backdrop, and mobile header shell. Each child page fills in the main content area: empty state or `FolderPanel`. Interaction state (renaming, confirming, addingSubfolder) lives in `(app)/+layout.svelte` since it's needed by both the mobile header and `FolderPanel`.

### Navigation

All `setSelectedFolder(path)` calls are replaced with `goto(base + '/' + path)`.  
Deselecting (after delete, or closing a folder) becomes `goto(base + '/')`.

### `ui.svelte.ts`

`selectedFolder` state and `getSelectedFolder` / `setSelectedFolder` are removed. `sidebarOpen` and `sidebarCollapsed` are unchanged.

## Data Flow

1. User visits `/work/projects` (fresh load or refresh)
2. Layout `onMount` loads notes from GitHub / IndexedDB
3. `[...path]/+page.svelte` reads `params.path` → `"work/projects"`
4. Validates against `getFolderTree()` — if no match, `goto(base + '/')`
5. Renders `FolderPanel` with the matched folder

## Edge Cases

- **Unknown path on refresh** — folder deleted since last visit → redirect to `/`
- **Root `/`** — no folder selected, shows empty state
- **Base path** — all `goto()` calls prepend `base` from `$app/paths` for GitHub Pages compatibility

## Testing

### Integration tests
- Tests that call `setSelectedFolder` directly will be updated to use mock navigation or derive folder from route params

### E2E tests (new)
- Refresh at a folder URL restores the correct folder
- Refresh at an unknown/deleted folder path redirects to `/`
- Browser back/forward navigates between previously visited folders
