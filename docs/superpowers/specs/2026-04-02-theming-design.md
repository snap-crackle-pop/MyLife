# Theming — Light/Dark Mode

**Date:** 2026-04-02  
**Status:** Approved

## Overview

Add a light theme (Catppuccin Latte) alongside the existing dark theme (Catppuccin Mocha). The user toggles between them via an icon-only button in the sidebar's action bar, next to "New folder". The selected theme persists across page refreshes via `localStorage`.

## CSS — `src/app.css`

All color tokens are already CSS custom properties on `:root`. Add a `[data-theme="light"]` block beneath `:root` that overrides every color token with Catppuccin Latte values:

```css
[data-theme="light"] {
  --bg-base: #eff1f5;
  --bg-surface: #e6e9ef;
  --bg-overlay: #dce0e8;
  --border: #bcc0cc;
  --text-primary: #4c4f69;
  --text-secondary: #5c5f77;
  --text-muted: #9ca0b0;
  --accent: #1e66f5;
  --accent-hover: #04a5e5;
  --danger: #d20f39;
  --success: #40a02b;
  --warning: #df8e1d;
}
```

No per-component CSS changes are needed — all components consume the tokens via `var(--*)`.

## Store — `src/lib/stores/ui.svelte.ts`

Add module-level theme state initialized from `localStorage`:

```ts
let theme = $state<'dark' | 'light'>(
  (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark'
);

export function getTheme() { return theme; }

export function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', theme);
}
```

`localStorage` is appropriate for a non-sensitive UI preference (the "no localStorage" rule in CLAUDE.md applies specifically to the GitHub PAT). The read is synchronous so there is no flash on load.

## Applying the Theme — `src/routes/+layout.svelte`

Add a `$effect` to the existing root layout that keeps `document.documentElement.dataset.theme` in sync with the store:

```ts
$effect(() => {
  document.documentElement.dataset.theme = getTheme();
});
```

This fires on mount (setting the initial theme) and on every toggle. The `[data-theme="light"]` CSS selector on `<html>` activates the light palette.

## Toggle Button — `src/lib/components/Sidebar.svelte`

Add two props:

```ts
interface Props {
  // ...existing props
  theme?: 'dark' | 'light';
  ontoggletheme?: () => void;
}
```

In `sidebar-actions`, add an icon-only button next to "New folder" using the existing `action-btn` class:

- **Sun icon** when `theme === 'dark'` (click → go light)
- **Moon icon** when `theme === 'light'` (click → go dark)
- `aria-label` reflects the action: "Switch to light mode" / "Switch to dark mode"

## Wiring — `src/routes/(app)/+layout.svelte`

Derive theme from the store and pass it to `Sidebar`:

```svelte
let theme = $derived(getTheme());

<Sidebar
  ...
  {theme}
  ontoggletheme={toggleTheme}
/>
```

## Testing

Follow the existing `vi.resetModules()` + dynamic import pattern for `ui.svelte.ts` tests:

- **Store**: toggle changes `getTheme()` return value; `localStorage.setItem` is called with the new value; init reads from `localStorage` when present.
- **Integration**: render `(app)/+layout.svelte` with mocked store; click the toggle button; assert `document.documentElement.dataset.theme` flips.

No E2E test needed — this is a pure UI preference with no GitHub API interaction.

## Files Changed

| File | Change |
|------|--------|
| `src/app.css` | Add `[data-theme="light"]` block |
| `src/lib/stores/ui.svelte.ts` | Add `theme` state, `getTheme`, `toggleTheme` |
| `src/routes/+layout.svelte` | Add `$effect` to apply `data-theme` on `<html>` |
| `src/lib/components/Sidebar.svelte` | Add `theme` + `ontoggletheme` props, sun/moon toggle button |
| `src/routes/(app)/+layout.svelte` | Derive theme, wire props to Sidebar |
