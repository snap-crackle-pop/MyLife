# Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MyLife fully usable on mobile for both reading and active note editing, using a slide-in drawer for navigation and a viewport-aware toolbar that floats above the soft keyboard.

**Architecture:** Single `768px` CSS breakpoint. Drawer state lives in the existing `ui.svelte.ts` store (`sidebarOpen`). A new `viewport.svelte.ts` store tracks keyboard height via `visualViewport`. Desktop layout is completely unchanged.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, CSS custom properties, `visualViewport` API, Vitest + @testing-library/svelte, Playwright

---

## File Map

| File | Change |
|---|---|
| `src/lib/stores/ui.svelte.ts` | Change `sidebarOpen` initial value from `true` → `false` |
| `src/lib/stores/viewport.svelte.ts` | **New.** Tracks keyboard height via `visualViewport` |
| `src/lib/components/Sidebar.svelte` | Add `isOpen` + `onclose` props; drawer CSS; close button; touch targets |
| `src/routes/+page.svelte` | Import `sidebarOpen` state; add mobile header with hamburger; add backdrop; `100dvh`; mobile CSS |
| `tests/integration/mobile-drawer.test.ts` | **New.** Sidebar drawer open/close behaviour + viewport store |
| `tests/e2e/mobile-layout.spec.ts` | **New.** Full drawer flow at 375×812 viewport |

---

## Task 1: Viewport Store

**Files:**
- Create: `src/lib/stores/viewport.svelte.ts`
- Create: `tests/integration/mobile-drawer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/mobile-drawer.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Viewport store ────────────────────────────────────────────────────────────

describe('viewport store', () => {
  let fireResize: () => void;

  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(window, 'innerHeight', {
      value: 844,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height: 844,
        addEventListener(_: string, cb: () => void) {
          fireResize = cb;
        },
        removeEventListener: vi.fn(),
      },
    });
  });

  it('returns 0 when keyboard is closed', async () => {
    const { getKeyboardOffset } = await import('$lib/stores/viewport.svelte');
    expect(getKeyboardOffset()).toBe(0);
  });

  it('returns keyboard height when keyboard opens', async () => {
    const { getKeyboardOffset } = await import('$lib/stores/viewport.svelte');
    // Simulate 300px keyboard opening (viewport shrinks from 844 → 544)
    Object.defineProperty(window.visualViewport!, 'height', {
      value: 544,
      configurable: true,
    });
    fireResize();
    expect(getKeyboardOffset()).toBe(300);
  });

  it('returns 0 again when keyboard closes', async () => {
    const { getKeyboardOffset } = await import('$lib/stores/viewport.svelte');
    Object.defineProperty(window.visualViewport!, 'height', {
      value: 544,
      configurable: true,
    });
    fireResize();
    Object.defineProperty(window.visualViewport!, 'height', {
      value: 844,
      configurable: true,
    });
    fireResize();
    expect(getKeyboardOffset()).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --reporter=verbose tests/integration/mobile-drawer.test.ts
```

Expected: 3 failures — `Cannot find module '$lib/stores/viewport.svelte'`

- [ ] **Step 3: Implement the viewport store**

Create `src/lib/stores/viewport.svelte.ts`:

```ts
let keyboardOffset = $state(0);

if (typeof window !== 'undefined' && window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    keyboardOffset =
      window.innerHeight - (window.visualViewport?.height ?? window.innerHeight);
  });
}

export function getKeyboardOffset() {
  return keyboardOffset;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --reporter=verbose tests/integration/mobile-drawer.test.ts
```

Expected: 3 passing (viewport store tests only — drawer tests don't exist yet)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/viewport.svelte.ts tests/integration/mobile-drawer.test.ts
git commit -m "feat: add viewport store for keyboard offset tracking"
```

---

## Task 2: Sidebar Drawer — Props and Close Button

**Files:**
- Modify: `src/lib/components/Sidebar.svelte`
- Modify: `tests/integration/mobile-drawer.test.ts` (add drawer tests)

- [ ] **Step 1: Add failing tests for new Sidebar props**

Append to `tests/integration/mobile-drawer.test.ts`:

```ts
import { render, screen, fireEvent } from '@testing-library/svelte';

// ── Sidebar drawer props ───────────────────────────────────────────────────

describe('Sidebar drawer props', () => {
  it('shows a close button when onclose prop is provided', async () => {
    const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
    render(Sidebar, {
      props: {
        folders: [{ path: 'inbox', name: 'inbox', children: [] }],
        selectedFolder: null,
        isOpen: true,
        onclose: vi.fn(),
      },
    });
    expect(screen.getByRole('button', { name: 'Close folders' })).toBeInTheDocument();
  });

  it('calls onclose when close button is clicked', async () => {
    const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
    const onclose = vi.fn();
    render(Sidebar, {
      props: {
        folders: [],
        selectedFolder: null,
        isOpen: true,
        onclose,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Close folders' }));
    expect(onclose).toHaveBeenCalledOnce();
  });

  it('adds open class to nav when isOpen is true', async () => {
    const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
    render(Sidebar, {
      props: {
        folders: [],
        selectedFolder: null,
        isOpen: true,
      },
    });
    expect(screen.getByRole('navigation')).toHaveClass('open');
  });

  it('does not add open class when isOpen is false', async () => {
    const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
    render(Sidebar, {
      props: {
        folders: [],
        selectedFolder: null,
        isOpen: false,
      },
    });
    expect(screen.getByRole('navigation')).not.toHaveClass('open');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --reporter=verbose tests/integration/mobile-drawer.test.ts
```

Expected: 4 new failures (isOpen / onclose props not yet implemented)

- [ ] **Step 3: Update Sidebar.svelte — add props and close button**

Replace the `<script>` block and `<nav>` element in `src/lib/components/Sidebar.svelte`. The full updated component head and template:

```svelte
<script lang="ts">
  import type { Folder } from '$lib/types';

  interface Props {
    folders: Folder[];
    selectedFolder: string | null;
    isOpen?: boolean;
    onselectfolder?: (path: string) => void;
    oncreatefolder?: (name: string) => void;
    onclose?: () => void;
  }

  let { folders, selectedFolder, isOpen = false, onselectfolder, oncreatefolder, onclose }: Props =
    $props();

  let adding = $state(false);
  let newFolderName = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  function startAdding() {
    adding = true;
    newFolderName = '';
  }

  $effect(() => {
    if (adding && inputEl) inputEl.focus();
  });

  function confirmAdd() {
    const name = newFolderName.trim();
    if (name) oncreatefolder?.(name);
    adding = false;
    newFolderName = '';
  }

  function cancelAdd() {
    adding = false;
    newFolderName = '';
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') confirmAdd();
    if (e.key === 'Escape') cancelAdd();
  }
</script>

<nav class="sidebar" class:open={isOpen}>
  <div class="sidebar-header">
    <span class="sidebar-title">Folders</span>
    <button class="close-btn" onclick={onclose} aria-label="Close folders">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
  <!-- rest of template unchanged from here -->
```

Keep everything from `<ul class="folder-list">` to the end of the template identical to the original. Only the `<nav>` opening tag and `<div class="sidebar-header">` content change.

- [ ] **Step 4: Update Sidebar.svelte — drawer CSS**

Append inside the `<style>` block in `src/lib/components/Sidebar.svelte`:

```css
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 10px 16px;
}

.sidebar-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
}

.close-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--text-muted);
  border-radius: var(--radius);
}

.close-btn:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    width: 280px;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 200ms ease;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .close-btn {
    display: flex;
  }

  .folder-item {
    min-height: 44px;
    padding: 10px 16px;
  }

  .action-btn {
    min-height: 44px;
    padding: 10px 8px;
  }
}
```

Also remove the existing `.sidebar-header` rule (which only sets padding) since the new one above replaces it:

Remove this existing rule from the `<style>` block:
```css
.sidebar-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  padding: 0 16px 10px;
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test -- --reporter=verbose tests/integration/mobile-drawer.test.ts
```

Expected: all 7 tests passing

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/Sidebar.svelte tests/integration/mobile-drawer.test.ts
git commit -m "feat: add drawer props and close button to Sidebar"
```

---

## Task 3: Page Layout — Hamburger, Backdrop, and Mobile CSS

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/stores/ui.svelte.ts`

- [ ] **Step 1: Fix ui.svelte.ts initial sidebarOpen value**

In `src/lib/stores/ui.svelte.ts`, change line 1:

```ts
// Before:
let sidebarOpen = $state(true);

// After:
let sidebarOpen = $state(false);
```

- [ ] **Step 2: Replace +page.svelte with the mobile-ready version**

Full replacement of `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import Sidebar from '$lib/components/Sidebar.svelte';
  import FolderPanel from '$lib/components/FolderPanel.svelte';
  import {
    getFolderTree,
    getNotesInFolder,
    createFolder,
    renameFolder,
    deleteFolder
  } from '$lib/stores/notes.svelte';
  import {
    getSelectedFolder,
    setSelectedFolder,
    getSidebarOpen,
    setSidebarOpen
  } from '$lib/stores/ui.svelte';

  let folders = $derived(getFolderTree());
  let selectedFolder = $derived(getSelectedFolder());
  let folderNotes = $derived(selectedFolder ? getNotesInFolder(selectedFolder) : []);
  let sidebarOpen = $derived(getSidebarOpen());

  async function handleCreateFolder(name: string) {
    await createFolder(name);
    setSelectedFolder(name);
    setSidebarOpen(false);
  }

  async function handleRename(newName: string) {
    if (!selectedFolder) return;
    await renameFolder(selectedFolder, newName);
    setSelectedFolder(newName);
  }

  async function handleDelete(folder: string) {
    await deleteFolder(folder);
    setSelectedFolder(null);
  }

  function handleSelectFolder(path: string) {
    setSelectedFolder(path);
    setSidebarOpen(false);
  }
</script>

<div class="app">
  <Sidebar
    {folders}
    {selectedFolder}
    isOpen={sidebarOpen}
    onselectfolder={handleSelectFolder}
    oncreatefolder={handleCreateFolder}
    onclose={() => setSidebarOpen(false)}
  />

  {#if sidebarOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="drawer-backdrop" onclick={() => setSidebarOpen(false)}></div>
  {/if}

  <main class="main">
    <div class="mobile-header">
      <button class="hamburger" onclick={() => setSidebarOpen(true)} aria-label="Open folders">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <span class="app-title">MyLife</span>
    </div>

    {#if selectedFolder}
      <FolderPanel
        folder={selectedFolder}
        notes={folderNotes}
        onrename={handleRename}
        ondelete={handleDelete}
      />
    {:else}
      <div class="empty-state">
        <p>Select a folder or create one to get started.</p>
      </div>
    {/if}
  </main>
</div>

<style>
  .app {
    display: flex;
    height: 100dvh;
    overflow: hidden;
  }

  .main {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .mobile-header {
    display: none;
  }

  .drawer-backdrop {
    display: none;
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 14px;
  }

  @media (max-width: 768px) {
    .app {
      flex-direction: column;
    }

    .main {
      overflow-y: auto;
    }

    .mobile-header {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 48px;
      padding: 0 4px 0 0;
      background: var(--bg-overlay);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .hamburger {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      color: var(--text-secondary);
      border-radius: var(--radius);
    }

    .hamburger:hover {
      background: var(--bg-surface);
      color: var(--text-primary);
    }

    .app-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .drawer-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 99;
    }
  }
</style>
```

- [ ] **Step 3: Run full test suite to confirm nothing is broken**

```bash
npm run validate
```

Expected: all 81 tests passing, no type errors, no lint errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte src/lib/stores/ui.svelte.ts
git commit -m "feat: add mobile drawer layout with hamburger and backdrop"
```

---

## Task 4: Touch Targets — FolderPanel

**Files:**
- Modify: `src/lib/components/FolderPanel.svelte`

The Sidebar touch targets were already addressed in Task 2. This task handles the FolderPanel action buttons (Rename, Delete, Confirm, Cancel).

- [ ] **Step 1: Add mobile touch target CSS to FolderPanel.svelte**

Append inside the `<style>` block in `src/lib/components/FolderPanel.svelte`:

```css
@media (max-width: 768px) {
  .action-btn {
    min-height: 44px;
    padding: 10px 14px;
  }

  .note-item {
    min-height: 44px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
  }
}
```

- [ ] **Step 2: Run validate**

```bash
npm run validate
```

Expected: all 81 tests passing, no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/FolderPanel.svelte
git commit -m "feat: increase touch target sizes on mobile"
```

---

## Task 5: E2E Mobile Tests

**Files:**
- Create: `tests/e2e/mobile-layout.spec.ts`

- [ ] **Step 1: Check the E2E setup helper pattern**

Read `tests/e2e/folder-workflow.spec.ts` lines 1–120 to understand the `mockGitHub` and `setupApp` helpers before writing the new spec.

- [ ] **Step 2: Write the E2E test file**

Create `tests/e2e/mobile-layout.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';

const REPO = 'testuser/mylife-notes';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function mockGitHub(page: Page, files: { path: string; content: string; sha: string }[] = []) {
  await page.route('https://api.github.com/**', (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/git/trees/main')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tree: files.map((f) => ({ path: f.path, type: 'blob', sha: f.sha }))
        })
      });
    }

    if (method === 'GET' && url.includes('/contents/')) {
      const urlObj = new URL(url);
      const filePath = urlObj.pathname.split('/contents/')[1];
      const file = files.find((f) => f.path === filePath);
      if (file) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: btoa(file.content), sha: file.sha })
        });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    }

    if (method === 'PUT') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'created-sha' } })
      });
    }

    if (method === 'DELETE') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function setupApp(page: Page, files: { path: string; content: string; sha: string }[] = []) {
  await mockGitHub(page, files);
  await page.goto('/setup');
  await page.locator('#token').fill('fake-token');
  await page.locator('#repo').fill(REPO);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('/');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('sidebar is hidden and hamburger is visible on load', async ({ page }) => {
    await setupApp(page, [{ path: 'inbox/.gitkeep', content: '', sha: 'sha1' }]);

    const nav = page.getByRole('navigation');
    const hamburger = page.getByRole('button', { name: 'Open folders' });

    // Hamburger visible
    await expect(hamburger).toBeVisible();

    // Sidebar translated off-screen (not visually visible)
    // The nav exists in DOM but has transform: translateX(-100%)
    await expect(nav).not.toBeInViewport();
  });

  test('hamburger opens the sidebar drawer', async ({ page }) => {
    await setupApp(page, [{ path: 'inbox/.gitkeep', content: '', sha: 'sha1' }]);

    await page.getByRole('button', { name: 'Open folders' }).click();

    const nav = page.getByRole('navigation');
    await expect(nav).toBeInViewport();
    await expect(page.getByText('inbox')).toBeVisible();
  });

  test('close button inside drawer closes the sidebar', async ({ page }) => {
    await setupApp(page, [{ path: 'inbox/.gitkeep', content: '', sha: 'sha1' }]);

    await page.getByRole('button', { name: 'Open folders' }).click();
    await expect(page.getByRole('navigation')).toBeInViewport();

    await page.getByRole('button', { name: 'Close folders' }).click();
    await expect(page.getByRole('navigation')).not.toBeInViewport();
  });

  test('selecting a folder closes the drawer', async ({ page }) => {
    await setupApp(page, [{ path: 'inbox/.gitkeep', content: '', sha: 'sha1' }]);

    await page.getByRole('button', { name: 'Open folders' }).click();
    await page.getByText('inbox').click();

    await expect(page.getByRole('navigation')).not.toBeInViewport();
    // Folder panel is visible
    await expect(page.getByText('inbox')).toBeVisible();
  });

  test('backdrop tap closes the drawer', async ({ page }) => {
    await setupApp(page, [{ path: 'inbox/.gitkeep', content: '', sha: 'sha1' }]);

    await page.getByRole('button', { name: 'Open folders' }).click();
    await expect(page.getByRole('navigation')).toBeInViewport();

    // Click the backdrop (right side of screen, outside drawer width of 280px)
    await page.mouse.click(350, 400);
    await expect(page.getByRole('navigation')).not.toBeInViewport();
  });
});
```

- [ ] **Step 3: Run the E2E tests (requires dev server)**

```bash
npm run test:e2e -- tests/e2e/mobile-layout.spec.ts
```

Expected: all 5 tests passing

- [ ] **Step 4: Run full validate**

```bash
npm run validate
```

Expected: all 81 unit/integration tests + E2E passing, no type/lint errors

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/mobile-layout.spec.ts
git commit -m "test: add E2E tests for mobile drawer layout"
```

---

## Self-Review Checklist

- [x] **Spec: `100dvh` fix** → Task 3, `+page.svelte` `.app` style
- [x] **Spec: sidebar drawer with transform** → Task 2 (Sidebar CSS) + Task 3 (page wiring)
- [x] **Spec: `sidebarOpen` local state** → Task 3 (uses existing `ui.svelte.ts`)
- [x] **Spec: hamburger opens, close button + backdrop + selecting note all close** → Task 3
- [x] **Spec: `visualViewport` store** → Task 1
- [x] **Spec: touch targets 44×44px minimum** → Task 2 (Sidebar) + Task 4 (FolderPanel)
- [x] **Spec: overflow fix on `.panel`** → Task 3 (`.main` gets `overflow-y: auto` on mobile)
- [x] **Spec: integration tests for drawer** → Task 2 (Sidebar props) + Task 1 (viewport store)
- [x] **Spec: E2E at 375×812** → Task 5
- [x] **Toolbar `bottom: keyboardOffset`** — No editor component exists yet in the codebase. The viewport store (Task 1) is in place; wire it to the toolbar when the editor is built.
