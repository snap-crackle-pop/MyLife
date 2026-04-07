# Global Note Search — Design Spec

**Date:** 2026-04-07  
**Status:** Approved

## Overview

Add a global full-text search feature that lets the user find text across all note content. Accessed via a magnifying glass icon in the sidebar actions bar, reusing the existing folder search input as the search field when in search mode.

## Interaction Model

### Entering search mode
- A magnifying glass icon is added as a fourth button in `sidebar-actions` (between the star filter and the theme toggle).
- Clicking it sets `searchMode = true` and the icon fills/activates (same `aria-pressed` pattern as the star filter button).
- The search input placeholder switches from "Search folders…" to "Search notes…".
- The folder list is replaced by the search results list.

### Results display
- Each result item shows:
  - The folder name (derived from `note.path` by dropping the filename)
  - A ~120-character text snippet centered on the first match, with the matched term rendered in a `<span>` with a yellow (`var(--warning)`) background at reduced opacity
- Results are rendered without `innerHTML` — the snippet is split into `[before, match, after]` parts and the match part is wrapped in a styled `<span>`.
- Clicking a result calls `onselectfolder(folderPath)` and exits search mode.

### Match count
- A small line below the search input reads: `"12 matches in 4 notes"` while results exist.
- Shows `"No results"` when the query is non-empty but nothing matches.
- Hidden when the query is blank.

### Exiting search mode
- Clicking the magnifying glass icon again exits search mode.
- When the sidebar closes on mobile (`!isOpen`), both `searchQuery` and `searchMode` are reset (extends existing `$effect`).

## Data & Search Logic

All notes are already in memory via the reactive `notes` store. No new API calls or props are needed.

### Store access
`Sidebar.svelte` imports `getNotes()` directly from `$lib/stores/notes.svelte` — consistent with how other route files use store functions.

### Derived search results
```ts
let searchResults = $derived.by(() => {
  if (!searchMode || !searchQuery.trim()) return [];
  const q = searchQuery.trim().toLowerCase();
  return getNotes()
    .filter(n => !n.path.endsWith('.gitkeep') && n.content.toLowerCase().includes(q))
    .map(n => ({
      folderPath: n.path.split('/').slice(0, -1).join('/'),
      snippet: extractSnippet(n.content, q),   // returns { before, match, after }
      matchCount: countMatches(n.content, q)
    }));
});

let totalMatchCount = $derived(searchResults.reduce((sum, r) => sum + r.matchCount, 0));
```

### Helper functions (module-local to Sidebar.svelte)
- **`extractSnippet(content, query)`** — finds the first occurrence index, slices up to 60 chars before and after, returns `{ before: string, match: string, after: string }`.
- **`countMatches(content, query)`** — counts all case-insensitive occurrences in the content string.

Both are pure functions, no side effects.

### Search characteristics
- Case-insensitive
- Synchronous (in-memory only)
- No debounce needed — same approach as existing folder filter
- Excludes `.gitkeep` files

## Component Changes

### `Sidebar.svelte` — only file changed

**Script additions:**
- Import `getNotes` from `$lib/stores/notes.svelte`
- `let searchMode = $state(false)`
- `searchResults` and `totalMatchCount` derived values (see above)
- `extractSnippet` and `countMatches` pure helper functions
- Extend existing `$effect(() => { if (!isOpen) ... })` to also reset `searchMode = false`

**Template additions:**
- Magnifying glass `action-btn` in `.sidebar-actions` with `aria-pressed={searchMode}`
- Match count line inside `.search-wrap`, below the `<input>`
- Conditional render in the folder list area:
  ```svelte
  {#if searchMode && searchQuery.trim()}
    <!-- search results list -->
  {:else}
    <!-- existing filteredFolders list -->
  {/if}
  ```

**Style additions:**
- `.search-count` — small muted text below the input
- `.result-item` — result row with folder name + snippet
- `.result-match` — yellow background highlight span (`background: var(--warning); opacity: 0.3; border-radius: 2px`)
- `.result-folder` — folder label at top of each result item

### No changes to:
- `notes.svelte.ts`
- `FolderPanel.svelte`
- Any route files

## Testing

Integration test (`tests/integration/note-search.test.ts`):
- Search with a matching term returns the correct notes
- Search is case-insensitive
- Match count reflects all occurrences
- Empty query shows no results / restores folder list
- Non-matching query shows "No results"
- Clicking a result calls `onselectfolder` with the correct folder path

No E2E tests needed — the feature is self-contained within the sidebar and the integration tests cover the critical paths.
