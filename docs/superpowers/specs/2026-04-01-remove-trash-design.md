# Remove Trash Feature

**Date:** 2026-04-01  
**Status:** Approved

## Overview

Remove the soft-delete (trash) mechanism. Notes and folders are permanently deleted via the GitHub API. No recovery path.

## Store changes (`src/lib/stores/notes.svelte.ts`)

### `deleteNote(path)`

Current behaviour: creates a copy at `.trash/<filename>` then deletes the original.

New behaviour:
1. Optimistically remove the note from `notes` state and delete from cache immediately
2. Call `github.deleteFile(path, sha)` in the background
3. On success: nothing to patch — note is gone
4. On failure/offline: queue `{ action: 'delete', path, sha }` op (same queue pattern as other ops)

### `deleteFolder(name)`

Current behaviour: moves each note in the folder to `.trash/` before deleting the folder entry.

New behaviour:
1. Optimistically remove all notes in the folder from state and cache immediately
2. Call `github.deleteFile` for each note and the `.gitkeep` file in the background
3. On failure/offline: queue `delete` ops for each file

### `getFolderTree()`

Remove the `.filter((f) => f.name !== '.trash')` line — no longer needed since `.trash/` won't exist.

## UI changes

### `src/lib/components/Sidebar.svelte`

- Remove the trash icon button (`<button class="action-btn trash-btn">`)
- Remove its `class:active` binding and `onclick` handler
- Remove `.trash-btn` and `.trash-btn.active` CSS rules

### `src/lib/components/FolderPanel.svelte`

- Change delete confirmation copy from "will be moved to trash" to "will be permanently deleted"

## Test changes

### `tests/integration/note-crud.test.ts`

- Replace assertions like `notes.some((n) => n.path.startsWith('.trash/'))` with `notes.every((n) => n.path !== path)` (note gone from store)
- Replace mocked `createFile` (trash copy) calls with mocked `deleteFile` calls
- Remove tests that only verify trash-specific behaviour (SHA patching on trash path)
- Add/keep tests verifying: note removed from store optimistically, `deleteFile` called with correct path+sha, delete op queued on failure

### `tests/integration/folder-store.test.ts`

- Replace trash-path assertions with "notes no longer in store" assertions
- Replace mocked `createFile` (trash) calls with mocked `deleteFile` calls
- Remove tests: "moves real notes to .trash/", "patches trash SHA after API succeeds", "queues create-trash ops"
- Add equivalent tests: "removes notes from store optimistically", "calls deleteFile for each note", "queues delete ops on failure"

### `tests/integration/folder-management.test.ts`

- Update confirmation text assertions from `/will be moved to trash/i` to `/will be permanently deleted/i`
- Update the "does not show trash warning" test to match new copy

### `tests/e2e/folder-workflow.spec.ts`

- Update trash-warning text assertion to match new copy

## CLAUDE.md

Remove: `Soft delete: moves files to .trash/ folder in repo`  
Add: `Delete: permanently removes files via GitHub API`
