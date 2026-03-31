# Mobile Layout Design

**Date:** 2026-03-31
**Status:** Approved
**Approach:** Option B — Responsive + viewport-aware layout

---

## Overview

Make MyLife fully usable on mobile for both reading and active editing. The desktop layout is unchanged. All mobile changes are scoped to a single `768px` breakpoint.

---

## 1. Layout & Breakpoints

Single breakpoint: `@media (max-width: 768px)`.

- `.app` height: `100dvh` (fixes iOS Safari bottom bar clipping — replaces current `100vh`)
- `.panel` (editor area): `width: 100%` — takes full screen on mobile
- Sidebar: hidden by default, slides in as a fixed drawer
- Hamburger button (`☰`) added to editor header — mobile only, opens the drawer
- `overflow: hidden` removed from `.app` and `.panel` on mobile; replaced with `overflow-y: auto` on the editor content area only

Desktop layout is untouched.

---

## 2. Drawer

The sidebar becomes a slide-in drawer on mobile.

**Behaviour:**
- `position: fixed`, full height, `width: 280px`
- Hidden: `transform: translateX(-100%)`
- Open: `transform: translateX(0)`
- CSS transition: `transform 200ms ease`
- `z-index: 100`

**Backdrop:**
- `<div class="drawer-backdrop">` rendered when drawer is open
- `position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 99`
- Tap backdrop → close drawer

**State:**
- Single `sidebarOpen: boolean` using `$state` in the top-level layout component
- No new store file — purely local UI state
- Open: hamburger button tap
- Close: backdrop tap, close button (`✕`) inside drawer, or selecting a note

**"Back to folders" flow:**
Opening a note automatically closes the drawer, returning the user to the full-screen editor. Re-opening the drawer gives access to the folder tree again.

---

## 3. Viewport-Aware Toolbar

When the soft keyboard opens on mobile, the formatting toolbar must float above it.

**Implementation:** A small reactive store `src/lib/stores/viewport.svelte.ts` using the `visualViewport` API:

```ts
let keyboardOffset = $state(0);

if (typeof window !== 'undefined') {
  window.visualViewport?.addEventListener('resize', () => {
    keyboardOffset = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight);
  });
}

export function getKeyboardOffset() { return keyboardOffset; }
```

The editor toolbar is `position: fixed` at the bottom of the viewport on mobile, with `bottom: {keyboardOffset}px` bound via inline style. When the keyboard is hidden, `keyboardOffset` is `0` so the toolbar sits at the screen bottom. When keyboard opens, it floats up to sit just above it. On desktop the toolbar is not fixed-position — no effect.

**Why `visualViewport`:** iOS Safari does not reliably support `env(keyboard-inset-height)`. The `visualViewport` API works on iOS 13+ and all modern Android browsers.

---

## 4. Touch Targets

All interactive elements must meet 44×44px minimum (Apple HIG / WCAG 2.5.5). All changes scoped to the mobile breakpoint.

| Element | Fix |
|---|---|
| Folder tree items | `min-height: 44px; padding: 10px 12px` |
| Action buttons (new note, delete, rename) | `min-width: 44px; min-height: 44px` via padding — visible icon unchanged |
| Hamburger button | Explicit `44×44px` |
| Drawer close button | Explicit `44×44px` |

---

## 5. Testing

### Integration tests (Vitest + @testing-library/svelte)
- Drawer opens when hamburger is clicked
- Drawer closes when backdrop is tapped
- Drawer closes when a note is selected
- `viewportStore` returns correct `keyboardOffset` when `visualViewport` fires a resize event (mock `window.visualViewport`)

### E2E tests (Playwright)
- Set viewport to `375×812` (iPhone 14) via `page.setViewportSize()`
- Sidebar hidden on load → hamburger visible → click opens drawer → select note → drawer closes → editor visible
- Edit a note: verify toolbar is present and tappable above keyboard area

---

## Files Expected to Change

- `src/app.css` — breakpoint block, `100dvh`, touch target sizes, drawer styles
- `src/lib/stores/viewport.svelte.ts` — new file, `keyboardOffset` state
- `src/lib/components/Sidebar.svelte` — drawer wrapper styles, close button
- Top-level layout component (likely `src/routes/+layout.svelte` or `src/lib/components/App.svelte`) — `sidebarOpen` state, hamburger button, backdrop
- Editor toolbar component — reads `keyboardOffset`, applies `margin-bottom`
- `tests/integration/mobile-drawer.test.ts` — new integration tests
- `tests/e2e/mobile-layout.spec.ts` — new E2E tests
