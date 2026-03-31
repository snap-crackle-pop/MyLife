# Sub-folder Support Design

**Date:** 2026-03-31
**Status:** Approved

## Overview

Allow top-level folders to contain one level of sub-folders. Sub-folder creation happens via a new icon button in the folder panel header (and mobile header), sitting between the existing Rename and Delete icons. The sidebar displays sub-folders as an always-expanded indented tree.

## Constraints

- **Max depth: 1.** Top-level folders can have sub-folders. Sub-folders cannot have their own children.
- No new routes or pages — everything happens within the existing single-page layout.

## Data Model

No changes to `Folder` in `types.ts` — `children: Folder[]` already exists.

No changes to `buildFolderTree` in `notes.svelte.ts` — it already constructs a recursive tree from file paths. A file at `work/projects/note.md` already produces a `work` folder with a `projects` child.

`createFolder(name)` already works for nested paths: calling `createFolder('work/projects')` creates `work/projects/.gitkeep`, which is correctly picked up by `buildFolderTree`. No store function changes needed.

`renameFolder` and `deleteFolder` already use `startsWith(name + '/')`, so renaming/deleting a top-level folder correctly cascades to its sub-folders.

## Sidebar — Always-Expanded Tree

`Sidebar.svelte` currently renders only `folders` (top-level). Update the template to render each folder's `children` immediately below it, indented by 20px, as a flat nested list. No recursion needed since depth is capped at 1.

Sub-folder items use smaller font (12px vs 13px) and a smaller folder icon (12px vs 14px) to visually distinguish depth. Active state (border-right accent, highlighted background) works the same as top-level items.

The `onselectfolder` prop already passes the full path — sub-folders pass `work/projects` directly. No prop changes to `Sidebar`.

## FolderPanel Header — All Icon Buttons

The existing text buttons ("Rename", "Delete") become icon-only buttons. A third icon button (folder-plus) is added between them.

| Button | Icon | Aria label | Visible when |
|---|---|---|---|
| Rename | Pencil (edit) SVG | "Rename" | Always (when not renaming/confirming) |
| Add sub-folder | Folder-plus SVG | "Add sub-folder" | Top-level folder only (`folder` contains no `/`) |
| Delete | Trash SVG | "Delete" | Always (when not renaming/confirming) |

When a sub-folder is selected, only Rename and Delete appear — no folder-plus (since sub-folders cannot have children).

### New prop on FolderPanel

```ts
interface Props {
  // existing props unchanged...
  addingSubfolder: boolean;
  subfolderName: string;
  onstartaddsubfolder?: () => void;
  onsubfolderinput?: (value: string) => void;
  onconfirmsubfolder?: () => void;
  oncancelsubfolder?: () => void;
}
```

### Inline sub-folder input

When `addingSubfolder` is true, a new row appears directly below the panel header (above the note count):

```
[ folder-icon ]  [ input: "sub-folder name"______ ]  Enter ↵ · Esc
```

The input is auto-focused on mount. Enter confirms, Escape cancels, blur cancels. On confirm, the page calls `createFolder('${selectedFolder}/${name}')` then selects the new sub-folder.

## +page.svelte State

New state added alongside the existing `renaming` / `confirming` state:

```ts
let addingSubfolder = $state(false);
let subfolderName = $state('');
```

Reset to `false` on folder change (same `$effect` block as `renaming` and `confirming`).

New handlers:

```ts
function startAddSubfolder() {
  addingSubfolder = true;
  subfolderName = '';
}

function cancelAddSubfolder() {
  addingSubfolder = false;
}

async function confirmAddSubfolder() {
  const name = subfolderName.trim();
  addingSubfolder = false;
  if (name && selectedFolder) {
    const path = `${selectedFolder}/${name}`;
    await createFolder(path);
    setSelectedFolder(path);
  }
}
```

**Rename of a sub-folder:** `renameFolder(oldPath, newPath)` replaces the full path prefix. When renaming a sub-folder, the page must pass the full new path: `renameFolder('work/projects', 'work/archive')`, not just `renameFolder('work/projects', 'archive')`. The existing `confirmRename` handler constructs `newName` from `renameName.trim()` and passes it directly. For sub-folders, `handleRename` must prepend the parent: if `selectedFolder` contains a `/`, the new path is `${parentSegment}/${newName}`. Specifically:

```ts
async function handleRename(newName: string) {
  if (!selectedFolder) return;
  const parts = selectedFolder.split('/');
  const fullNewName = parts.length > 1
    ? `${parts.slice(0, -1).join('/')}/${newName}`
    : newName;
  await renameFolder(selectedFolder, fullNewName);
  setSelectedFolder(fullNewName);
}
```

## Mobile Header

The mobile header already shows icon buttons for rename and delete when a top-level folder is selected. A third icon (folder-plus) is added between rename and delete, using the same `header-icon-btn` style.

The folder-plus icon is only rendered when `selectedFolder` does not contain `/` (i.e., is a top-level folder). Clicking it sets `addingSubfolder = true`, which causes the inline input to appear in the FolderPanel below (same state, same component — the mobile header drives the same page-level state).

When `addingSubfolder` is true in mobile view, the folder panel's inline input is visible below the mobile header bar.

## Interaction States Summary

| State | Panel header shows | Panel body shows |
|---|---|---|
| Top-level folder, idle | folder name + pencil + folder-plus + trash | note list |
| Top-level folder, adding sub-folder | folder name + dimmed icons | inline sub-folder input row, then note list |
| Top-level folder, renaming | rename input + confirm + cancel | note list |
| Top-level folder, confirming delete | folder name (no icons) | confirm bar |
| Sub-folder, idle | folder name + pencil + trash (no folder-plus) | note list |

## Testing

### Integration tests (new file: `tests/integration/subfolder.test.ts`)

- Sidebar renders sub-folders indented under their parent
- Sidebar sub-folder items are selectable (call `onselectfolder` with full path)
- FolderPanel shows folder-plus icon for top-level folders
- FolderPanel does not show folder-plus icon for sub-folders
- Clicking folder-plus shows inline sub-folder input
- Confirming sub-folder input calls `createFolder` with `parent/name`
- Cancelling (Escape / blur) dismisses the input without creating anything
- Existing FolderPanel button tests updated: Rename/Delete are now icons, tested by aria-label

### E2E tests (appended to `tests/e2e/mobile-layout.spec.ts` or new file)

- Creating a sub-folder via the panel header → it appears indented in the sidebar
- Selecting a sub-folder shows its own folder panel
- Sub-folder panel does not show folder-plus icon
- Mobile: folder-plus icon visible for top-level, absent for sub-folder

## What Does NOT Change

- `Folder` type in `types.ts`
- `buildFolderTree` in `notes.svelte.ts`
- `createFolder`, `renameFolder`, `deleteFolder` store functions
- Desktop sidebar width or overall layout
- Note list rendering inside FolderPanel
- Confirm-delete flow
