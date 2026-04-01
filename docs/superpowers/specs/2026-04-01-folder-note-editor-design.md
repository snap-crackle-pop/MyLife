# Folder Note Editor — Design Spec

**Date:** 2026-04-01  
**Status:** Approved

## Overview

Replace the current multi-note list in `FolderPanel` with a single full-height text editor. Each folder owns exactly one note (`index.md`). When a user selects a folder, they can immediately type free-flowing text into the panel body.

## Data Model

- Each folder is represented by `{folderPath}/index.md` instead of the current `.gitkeep` sentinel.
- `index.md` starts with empty content when a folder is first created.
- `renameFolder` and `deleteFolder` require no changes — they already operate on all files under a folder path.

## Store Changes (`notes.svelte.ts`)

1. **`createFolder(name)`** — creates `{name}/index.md` with empty content instead of `{name}/.gitkeep`.
2. **`getNotesInFolder(folder)`** — updated to filter out nothing special; returns only notes whose directory matches the folder (the `.gitkeep` exclusion is removed, no new exclusion needed).
3. **`getFolderNote(folder): Note | null`** — new export; returns the note at `{folder}/index.md` or `null` if not yet in state.

## UI Changes

### `FolderPanel.svelte`

- **Remove**: note list (`<ul class="note-list">`), note count label, and all associated props (`notes`, multi-note callbacks).
- **Add**: full-height `<textarea>` in the panel body, pre-filled with `note.content` (or empty if `note` is null).
- **Auto-save**: debounced 800 ms after the user stops typing — calls the `onsave(content: string)` callback prop.
- **Props in**: `note: Note | null`, `onsave: (content: string) => void` (plus existing folder management props unchanged).

### `+page.svelte`

- Pass `note={getFolderNote(selectedFolder)}` to `FolderPanel` instead of the notes array.
- Handle `onsave` by calling `updateNote(note.path, content)`.

## Optimistic Updates

Follows existing pattern: `updateNote` updates state and cache immediately, then syncs to GitHub in the background. No changes to the sync/queue logic.

## Testing

- Integration test: creating a folder → `index.md` is created with empty content.
- Integration test: typing in the editor → `updateNote` is called with debounced content.
- Update any existing folder tests that reference `.gitkeep` to reference `index.md`.
- E2E: create folder → type in panel → reload → content persists from cache.

## Out of Scope

- Todo/checkbox mode (deferred).
- Multiple notes per folder (deferred).
- Note editor on mobile header (deferred).
