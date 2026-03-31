# Mobile Header Redesign

**Date:** 2026-03-31
**Status:** Approved, ready for implementation

## Problem

On mobile, the app renders two stacked bars when a folder is selected:
1. A fixed `.mobile-header` in `+page.svelte` showing hamburger + "MyLife" title
2. A `.panel-header` in `FolderPanel.svelte` showing folder name + "Rename" / "Delete" text buttons

This wastes vertical space and splits related information across two rows.

## Design

Collapse both bars into one unified 48px mobile header bar.

### States

**No folder selected**
- Hamburger | "MyLife" title (unchanged from current)
- No action icons shown

**Folder selected (default)**
- Hamburger | folder name (flex: 1, truncated) | pencil icon (rename) | trash icon (delete)
- The `.panel-header` in `FolderPanel` is hidden on mobile

**Renaming (after tapping pencil)**
- Hamburger | inline text input (prefilled with current folder name) | green checkmark icon (confirm) | grey X icon (cancel)
- Enter key confirms; Escape cancels
- Blur on input cancels (existing behaviour)

**Delete confirming (after tapping trash)**
- Header reverts to: hamburger | folder name (no action icons)
- Confirm bar appears below header as a separate row (existing `.confirm-bar` pattern unchanged)

### Icons
- Rename: pencil/edit SVG line icon
- Delete: trash SVG line icon
- Confirm rename: checkmark SVG
- Cancel rename: X SVG

All icons are flat monochrome SVG line icons, consistent with existing app icons.

## Implementation Scope

### `+page.svelte`
- Pass `selectedFolder`, `renaming` state, and rename/delete callbacks down as props to a new shared header or handle inline
- On mobile, replace "MyLife" with `selectedFolder` display name when a folder is selected
- Show pencil + trash icons when folder is selected and not renaming
- Show input + confirm/cancel icons when renaming
- Hide `.panel-header` section inside `FolderPanel` on mobile (via CSS `display: none` at `@media (max-width: 768px)`)

### `FolderPanel.svelte`
- Expose rename/delete state and handlers so `+page.svelte` can drive the mobile header
- Or: lift rename state up to `+page.svelte` and pass it into `FolderPanel` as a prop
- On mobile, `.panel-header` is hidden (the mobile header takes its place)
- `.confirm-bar` remains visible on mobile (it renders below the header)

### State ownership
Rename state (`renaming`, `renameName`) moves up to `+page.svelte` so the mobile header can render the inline input. `FolderPanel` receives `renaming` as a prop and conditionally hides its own header row on mobile.

## Desktop behaviour
No changes. The existing `.panel-header` with text buttons continues to render on desktop (`> 768px`).

## Testing
- Update or add integration tests for mobile rename and delete flows via the mobile header
- Existing E2E tests should continue to pass; add a mobile-viewport E2E test if not already covered
