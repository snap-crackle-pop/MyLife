# Star Folders Feature — Design Spec

**Date:** 2026-04-02

## Overview

Users can star folders to mark them as important. Starred folders show a visual indicator in the sidebar. A filter toggle in the sidebar actions hides non-starred folders. Stars are persisted to GitHub so they sync across devices.

---

## Data & Persistence

### GitHub storage

Stars are stored as `_stars.json` at the repo root — a flat JSON array of starred folder paths:

```json
["work", "work/projects", "inbox"]
```

This file has no parent folder so it never appears in the folder tree. It is not a `Note` and never enters the notes array. `loadNotes()` must filter out any note with path `_stars.json` after syncing, so it never enters `notes` state.

### IndexedDB cache

Cached under key `starred-folders` as:

```ts
{ paths: string[], sha: string }
```

Loaded during `loadNotes()`. Written back on every toggle.

### State in `notes.svelte.ts`

```ts
let starredFolders = $state<string[]>([]);
let starsSha = $state<string>('');
```

---

## Store API

Three new exports from `notes.svelte.ts`:

```ts
export function getStarredFolders(): string[]
export function isStarredFolder(path: string): boolean
export async function toggleStarFolder(path: string): Promise<void>
```

### `toggleStarFolder` optimistic pattern

1. Add/remove `path` from `starredFolders` immediately
2. Save `{ paths, sha }` to IndexedDB cache
3. Write `_stars.json` to GitHub in the background:
   - No SHA → `github.createFile('_stars.json', json)`
   - Has SHA → `github.updateFile('_stars.json', json, sha)`
4. On success: patch `starsSha` with the returned SHA
5. On failure/offline: queue a `create` or `update` op for `_stars.json`

### Loading during `loadNotes()`

- Read `starred-folders` from IndexedDB cache on startup
- If online, fetch `_stars.json` from GitHub and update cache + state
- If the file does not exist yet, `starredFolders` starts as `[]`

---

## UI Changes

### FolderPanel.svelte (desktop panel header)

New props:
```ts
starred?: boolean
ontogglestar?: () => void
```

A star button is added next to the delete button in the header actions row. When `starred` is true, the SVG renders filled with `var(--yellow)`. When false, it renders as a stroke outline in `var(--text-muted)`.

### `[...path]/+page.svelte` (mobile header)

Same star button added to the mobile header row, next to rename/subfolder/delete. Calls `toggleStarFolder(selectedFolder)` on click. Reads `isStarredFolder(selectedFolder)` for fill state.

### Sidebar.svelte

**Per-folder star indicator:**
Each folder row (top-level and subfolder) gets a small star icon aligned to the right. It is only visible when that folder is starred. Clicking it has no action — it is an indicator only (starring is done from the folder panel).

**Filter toggle button:**
A new star button is added to `sidebar-actions`, between the new-folder button and the theme button. It controls `showStarredOnly = $state(false)`. When active the icon is filled with `var(--yellow)`; when inactive it is a muted outline.

**Filter logic when `showStarredOnly` is true:**
A folder row is included if:
- Its path is in `starredFolders`, OR
- Any of its children are in `starredFolders`

Children are pruned to only starred subfolders when the filter is active. This ensures a starred subfolder always shows its parent as a container.

This logic runs inside `filteredFolders` (the existing `$derived.by` block in `Sidebar.svelte`), combined with the existing search filter.

### `+layout.svelte`

Pass `starredFolders` (from `getStarredFolders()`) and `isStarredFolder` into `Sidebar` as props.

---

## Component Prop Changes Summary

| Component | New props |
|---|---|
| `Sidebar.svelte` | `starredFolders: string[]` |
| `FolderPanel.svelte` | `starred: boolean`, `ontogglestar?: () => void` |

---

## CSS / Visual

- Starred star: `fill: var(--yellow)`, `stroke: none`
- Unstarred star in panel: `fill: none`, `stroke: var(--text-muted)`, `stroke-width: 2`
- Unstarred indicator in sidebar: hidden (`display: none` or `visibility: hidden`)
- Filter button active: star icon `fill: var(--yellow)`
- Filter button inactive: star icon `fill: none`, `stroke: var(--text-muted)`

`--yellow` is not currently a defined CSS variable. Existing code uses the hardcoded hex `#f9e2af` for the sun icon. Define `--yellow: #f9e2af` in `app.css` alongside the other Catppuccin tokens, then use `var(--yellow)` in the star components.

---

## Testing

### Integration — `tests/integration/star-folder.test.ts`

- Toggle star on a folder: `starredFolders` updates, cache written, GitHub `createFile` called with correct JSON
- Toggle star off: folder removed from array, GitHub `updateFile` called
- Offline toggle: op queued, no GitHub call
- `isStarredFolder` returns correct value before and after toggle
- Loading: cache hit on startup populates `starredFolders` without GitHub call

### Integration — Sidebar filter (within existing or new test)

- `showStarredOnly` filter with no stars: shows all folders
- Filter with starred top-level: shows only that folder
- Filter with starred subfolder: shows parent folder + subfolder only; other children hidden

### E2E — `tests/e2e/star-folder.spec.ts`

- Star a folder → sidebar indicator appears
- Enable filter → only starred folder visible
- Disable filter → all folders visible
- Star a subfolder → enable filter → parent folder and subfolder both visible, other subfolders hidden
