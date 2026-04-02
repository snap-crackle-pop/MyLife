# Sidebar Folder Search

**Date:** 2026-04-02  
**Status:** Approved

## Summary

Add a search input at the top of the folder sidebar that filters the folder list in real-time, case-insensitively.

## Behaviour

- The search input is the first visible element in the sidebar on both desktop and mobile.
- Filtering is case-insensitive substring match on folder name.
- Empty query shows all folders unchanged.
- **Filtering logic (option B):**
  - Top-level folder name matches → include it with no children shown.
  - Top-level folder name does not match → include it as a container showing only matching children; exclude entirely if no children match either.
- No empty-state message — the list is simply empty when nothing matches.
- Search query resets to `''` when the sidebar closes, so mobile re-opens start fresh.

## Implementation

All changes are confined to `src/lib/components/Sidebar.svelte`. No new components, no prop changes, no store changes.

### New state

```ts
let searchQuery = $state('');

let filteredFolders = $derived.by(() => {
  if (!searchQuery.trim()) return folders;
  const q = searchQuery.trim().toLowerCase();
  const result: Folder[] = [];
  for (const folder of folders) {
    if (folder.name.toLowerCase().includes(q)) {
      result.push({ ...folder, children: [] });
    } else {
      const matchingChildren = folder.children.filter(c =>
        c.name.toLowerCase().includes(q)
      );
      if (matchingChildren.length > 0) {
        result.push({ ...folder, children: matchingChildren });
      }
    }
  }
  return result;
});
```

### Template change

- Add search `<input>` between `.sidebar-header` and `.folder-list`.
- Bind `bind:value={searchQuery}`.
- Render `filteredFolders` instead of `folders` in the `#each` loop.
- In the `onclose` handler: reset `searchQuery = ''`.

### Styling

- Full-width input, `padding: 6px 12px`, `margin: 6px 8px`, `font-size: 13px`.
- Border `1px solid var(--border)`, background `var(--bg-surface)`, border-radius `var(--radius)`.
- Placeholder text: `"Search folders…"` in `var(--text-muted)`.
- On mobile, same styles apply — sits below the close button row.

## Testing

- Add an integration test in `tests/integration/` covering:
  - Empty query shows all folders.
  - Query matching a top-level folder shows it with no children.
  - Query matching only a subfolder shows the parent as container + matching child only.
  - Query matching nothing shows empty list.
  - Case-insensitive matching (e.g. `"WORK"` matches `"work"`).
  - Search resets when sidebar closes.
