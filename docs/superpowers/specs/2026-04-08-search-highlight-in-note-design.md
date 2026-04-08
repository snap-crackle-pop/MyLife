# Search Highlight in Note — Design Spec

**Date:** 2026-04-08

## Overview

When a user clicks a search result in the sidebar, the note editor scrolls to and selects (highlights) the first occurrence of the search query using the browser's native text selection (`setSelectionRange`). Pressing Escape or starting to type clears the highlight.

## Data Flow

1. `ui.svelte` store gains a `searchHighlight` string (`$state('')`), with `setSearchHighlight(query)` and `getSearchHighlight()` exports.
2. `Sidebar.svelte`: when a search result button is clicked, call `setSearchHighlight(rawQuery)` before or alongside `onselectfolder(path)`. No new callback needed — the sidebar can call the store directly.
3. `FolderPanel.svelte`: reads `getSearchHighlight()` reactively. A `$effect` watches both `note` (the loaded note) and `searchHighlight`. When both are truthy, it finds the first case-insensitive match in `note.content`, computes `start`/`end` character offsets, calls `textareaEl.focus()` + `textareaEl.setSelectionRange(start, end)`, and scrolls the textarea to show the selection.
4. Clear conditions:
   - User presses **Escape** in the textarea → `setSearchHighlight('')`
   - User starts **typing** in the textarea (first `oninput`) → `setSearchHighlight('')`
   - User navigates to a **different folder** (note changes without a new search highlight) → `$effect` naturally does nothing if `searchHighlight` is already empty; navigating from non-search clears via the existing sidebar `clearSearch()` which can also call `setSearchHighlight('')`, or the effect simply won't fire because no highlight is set.

## Scroll-to-selection

`<textarea>` does not auto-scroll to a `setSelectionRange` call. After setting the range, compute the approximate line number of the match and set `textareaEl.scrollTop` proportionally:

```
const lineHeight = parseFloat(getComputedStyle(textareaEl).lineHeight);
const linesBefore = note.content.slice(0, matchIndex).split('\n').length - 1;
textareaEl.scrollTop = Math.max(0, linesBefore * lineHeight - textareaEl.clientHeight / 2);
```

## Components Changed

| File | Change |
|------|--------|
| `src/lib/stores/ui.svelte.ts` | Add `searchHighlight` state + `setSearchHighlight` / `getSearchHighlight` |
| `src/lib/components/Sidebar.svelte` | Call `setSearchHighlight(rawQuery)` on search result click |
| `src/lib/components/FolderPanel.svelte` | `$effect` to apply `setSelectionRange` + scroll; clear on Escape / input |

## Non-Goals

- No overlay/mark-all-occurrences rendering — `setSelectionRange` selects the first match only.
- No match count navigation (prev/next). Single jump to first match.
- No changes to the search logic in `search.ts`.

## Testing

- Integration test: simulate clicking a search result → assert textarea selection indices match the expected match position in the note content.
- Integration test: after applying highlight, fire an `input` event → assert `getSearchHighlight()` returns `''`.
- Integration test: after applying highlight, fire `keydown` Escape → assert `getSearchHighlight()` returns `''`.
